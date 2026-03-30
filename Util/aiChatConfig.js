const { updateAiConfig } = require('./aiModeStorage');

function toSafeText(value) {
    return (value === undefined || value === null) ? '' : String(value);
}

function normalizeBoolWord(value) {
    const s = toSafeText(value).trim().toLowerCase();
    if (!s) return null;
    if (['1', 'true', 'yes', 'y', 'on', 'si', 'sí'].includes(s)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
    return null;
}

function tryParseNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

function clamp(n, min, max) {
    const v = Number(n);
    if (!Number.isFinite(v)) return NaN;
    return Math.min(max, Math.max(min, v));
}

function parseChatConfig(textRaw) {
    const text = toSafeText(textRaw).trim();
    if (!text) return null;

    // Diseño: "cuando converse" pero sin comandos explícitos.
    // Para evitar falsos positivos, SOLO reaccionamos si el mensaje parece claramente
    // una instrucción de configuración.

    // 1) Formato directo: "clave: valor" (rápido y sin comandos)
    let m = text.match(/^(prompt|personalidad|instrucciones|system|modelo|model|temperatura|temp|cooldown|owners\s*-?only|ownersonly|owners)\s*:\s*(.*)$/i);

    // 2) Formato natural con intención: "configura/cambia/ajusta ..." + clave
    if (!m) {
        const intent = /^(configura|configurar|ajusta|ajustar|cambia|cambiar|establece|poner|pon|setea|set|desde ahora|a partir de ahora)\b/i;
        if (!intent.test(text)) return null;

        // ejemplos soportados:
        // - "configura personalidad: ..."
        // - "cambia modelo: gpt-4o-mini"
        // - "desde ahora responde: ..."  -> se interpreta como prompt
        // - "a partir de ahora personalidad: ..."
        m = text.match(/^(?:configura|configurar|ajusta|ajustar|cambia|cambiar|establece|poner|pon|setea|set|desde ahora|a partir de ahora)\s+(prompt|personalidad|instrucciones|system|modelo|model|temperatura|temp|cooldown|owners\s*-?only|ownersonly|owners)\s*[:=]\s*(.*)$/i);
        if (!m) {
            // Caso especial: "desde ahora responde ..." (sin dos puntos)
            const m2 = text.match(/^(?:desde ahora|a partir de ahora)\s+(?:quiero que\s+)?(?:respondas?|responda|hables?)\s+(.*)$/i);
            if (m2 && String(m2[1] || '').trim()) {
                return { patch: { systemPrompt: String(m2[1]).trim() }, kind: 'systemPrompt', value: String(m2[1]).trim() };
            }
            return null;
        }
    }

    const key = String(m[1] || '').trim().toLowerCase().replace(/\s+/g, '');
    const value = String(m[2] || '').trim();

    // "reset" / "clear" opcional
    const isClear = ['reset', 'clear', 'off', 'ninguno', 'none', 'default'].includes(value.toLowerCase());

    if (['prompt', 'personalidad', 'instrucciones', 'system'].includes(key)) {
        return { patch: { systemPrompt: isClear ? '' : value }, kind: 'systemPrompt', value: isClear ? '' : value };
    }

    if (['modelo', 'model'].includes(key)) {
        return { patch: { model: isClear ? '' : value }, kind: 'model', value: isClear ? '' : value };
    }

    if (['temperatura', 'temp'].includes(key)) {
        if (isClear) return { patch: { temperature: null }, kind: 'temperature', value: null };
        const t = clamp(tryParseNumber(value), 0, 2);
        if (!Number.isFinite(t)) return { error: 'invalid_temperature' };
        return { patch: { temperature: t }, kind: 'temperature', value: t };
    }

    if (key === 'cooldown') {
        if (isClear) return { patch: { cooldownMs: null }, kind: 'cooldownMs', value: null };
        const ms = clamp(Math.trunc(tryParseNumber(value)), 250, 10 * 60 * 1000);
        if (!Number.isFinite(ms)) return { error: 'invalid_cooldown' };
        return { patch: { cooldownMs: ms }, kind: 'cooldownMs', value: ms };
    }

    if (['owners-only', 'ownersonly', 'owners'].includes(key)) {
        const b = normalizeBoolWord(value);
        if (b === null) return { error: 'invalid_ownersOnly' };
        return { patch: { ownersOnly: b }, kind: 'ownersOnly', value: b };
    }

    return null;
}

function isAiChatConfigMessage(text) {
    return !!parseChatConfig(text);
}

async function maybeHandleAiChatConfigMessage(message) {
    const parsed = parseChatConfig(message?.content);
    if (!parsed) return { handled: false };
    if (parsed.error) return { handled: true, ok: false, error: parsed.error };

    if (!message?.guild?.id || !message?.channel?.id) {
        return { handled: true, ok: false, error: 'missing_context' };
    }

    await updateAiConfig(message.guild.id, message.channel.id, parsed.patch, { userId: message.author?.id });

    const ack = (() => {
        switch (parsed.kind) {
            case 'systemPrompt':
                return parsed.value
                    ? 'Listo: he actualizado mi personalidad en este canal.'
                    : 'Listo: he quitado la personalidad personalizada (vuelvo al default).';
            case 'model':
                return parsed.value
                    ? `Listo: usaré el modelo **${parsed.value}** en este canal.`
                    : 'Listo: vuelvo al modelo por defecto.';
            case 'temperature':
                return (parsed.value === null)
                    ? 'Listo: vuelvo a la temperatura por defecto.'
                    : `Listo: temperatura del canal = **${parsed.value}**`;
            case 'cooldownMs':
                return (parsed.value === null)
                    ? 'Listo: vuelvo al cooldown por defecto.'
                    : `Listo: cooldown del canal = **${parsed.value}ms**`;
            case 'ownersOnly':
                return parsed.value
                    ? 'Listo: owners-only **ON** (solo responderé a owners).'
                    : 'Listo: owners-only **OFF** (podré responder a cualquiera si el canal está ON).';
            default:
                return 'Listo: configuración actualizada.';
        }
    })();

    const payload = {
        content: ack,
        allowedMentions: { repliedUser: false, parse: [] },
    };

    // Best-effort: reply; si falla, send normal.
    const replied = await message.reply(payload).catch(() => null);
    if (!replied) await message.channel?.send?.(payload).catch(() => null);

    // Opcional: borrar el mensaje de configuración para no ensuciar el chat.
    const shouldDelete = String(process.env.AI_CHAT_CONFIG_DELETE || '0').trim() === '1';
    if (shouldDelete) {
        await message.delete().catch(() => null);
    }

    return { handled: true, ok: true };
}

module.exports = {
    isAiChatConfigMessage,
    maybeHandleAiChatConfigMessage,
};
