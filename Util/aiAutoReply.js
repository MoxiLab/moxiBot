const { chatCompletion, isOpenAiTemporarilyBlocked, getOpenAiBlockInfo } = require('./openaiChat');
const { isAiChatConfigMessage } = require('./aiChatConfig');

function clampInt(n, min, max, fallback) {
    const v = Math.trunc(Number(n));
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
}

function clampNumber(n, min, max, fallback) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
}

function defaultsFromEnv() {
    return {
        historyLimit: clampInt(process.env.AI_HISTORY_LIMIT, 1, 50, 12),
        maxInputChars: clampInt(process.env.AI_MAX_INPUT_CHARS, 500, 100000, 8000),
        cooldownMs: clampInt(process.env.AI_COOLDOWN_MS, 250, 10 * 60 * 1000, 5000),
        minChars: clampInt(process.env.AI_MIN_CHARS, 1, 2000, 2),
        temperature: clampNumber(process.env.OPENAI_TEMPERATURE, 0, 2, 0.7),
        model: (typeof process.env.OPENAI_MODEL === 'string' && process.env.OPENAI_MODEL.trim()) ? process.env.OPENAI_MODEL.trim() : 'gpt-4o-mini',
    };
}

const lastReplyAtByChannel = new Map(); // channelId -> timestamp

function toSafeText(value) {
    return (value === undefined || value === null) ? '' : String(value);
}

function stripBotMentions(text, botUserId) {
    const raw = toSafeText(text);
    if (!botUserId) return raw;
    return raw.replace(new RegExp(`<@!?${botUserId}>`, 'g'), '').trim();
}

function splitDiscordMessage(text, maxLen = 1900) {
    const s = toSafeText(text).trim();
    if (!s) return [];
    if (s.length <= maxLen) return [s];

    const parts = [];
    let cur = '';
    for (const line of s.split(/\n/g)) {
        if ((cur + (cur ? '\n' : '') + line).length > maxLen) {
            if (cur) parts.push(cur);
            cur = line;
            if (cur.length > maxLen) {
                // hard split
                while (cur.length > maxLen) {
                    parts.push(cur.slice(0, maxLen));
                    cur = cur.slice(maxLen);
                }
            }
        } else {
            cur = cur ? `${cur}\n${line}` : line;
        }
    }
    if (cur) parts.push(cur);
    return parts;
}

async function buildConversationFromChannel(message, { systemPrompt, historyLimit, maxInputChars } = {}) {
    const channel = message.channel;
    if (!channel || typeof channel.messages?.fetch !== 'function') return null;

    const envDefaults = defaultsFromEnv();
    const effectiveHistoryLimit = clampInt(historyLimit, 1, 50, envDefaults.historyLimit);
    const effectiveMaxInputChars = clampInt(maxInputChars, 500, 100000, envDefaults.maxInputChars);

    const fetched = await channel.messages.fetch({ limit: Math.min(50, Math.max(10, effectiveHistoryLimit * 2)) }).catch(() => null);
    const msgs = fetched ? Array.from(fetched.values()) : [];
    msgs.sort((a, b) => (a.createdTimestamp || 0) - (b.createdTimestamp || 0));

    const botId = message.client?.user?.id;

    const convo = [];
    if (systemPrompt) {
        convo.push({ role: 'system', content: String(systemPrompt) });
    }

    // Añadimos historial reciente (usuarios + bot), evitando comandos.
    for (const m of msgs.slice(-effectiveHistoryLimit)) {
        if (!m || !m.content) continue;
        if (m.author?.bot) {
            // Solo consideramos mensajes del propio bot como assistant
            if (botId && m.author?.id === botId) {
                convo.push({ role: 'assistant', content: stripBotMentions(m.content, botId).slice(0, effectiveMaxInputChars) });
            }
            continue;
        }

        const content = stripBotMentions(m.content, botId);
        if (!content) continue;
        // No meter "mensajes de configuración" en el historial.
        if (isAiChatConfigMessage(content)) continue;
        // Evitar comandos por prefijo universal '.' y típicos
        if (content.startsWith('.') || content.toLowerCase().startsWith('moxi ') || content.toLowerCase().startsWith('mx ')) {
            continue;
        }

        convo.push({ role: 'user', content: content.slice(0, effectiveMaxInputChars) });
    }

    // Asegurar que el mensaje actual esté al final (por si fetch no lo incluye todavía)
    const current = stripBotMentions(message.content, botId);
    if (current && !isAiChatConfigMessage(current)) {
        convo.push({ role: 'user', content: current.slice(0, effectiveMaxInputChars) });
    }

    return convo;
}

async function maybeAutoReplyWithAi(message, { lang, systemPrompt, model, temperature, cooldownMs, historyLimit, minChars, maxInputChars } = {}) {
    const content = toSafeText(message.content).trim();
    if (!content) return { ok: false, reason: 'empty' };

    const envDefaults = defaultsFromEnv();
    const effectiveCooldownMs = clampInt(cooldownMs, 250, 10 * 60 * 1000, envDefaults.cooldownMs);
    const effectiveMinChars = clampInt(minChars, 1, 2000, envDefaults.minChars);
    const effectiveHistoryLimit = clampInt(historyLimit, 1, 50, envDefaults.historyLimit);
    const effectiveMaxInputChars = clampInt(maxInputChars, 500, 100000, envDefaults.maxInputChars);
    const effectiveTemperature = (temperature === undefined) ? envDefaults.temperature : clampNumber(temperature, 0, 2, envDefaults.temperature);
    const effectiveModel = (typeof model === 'string' && model.trim()) ? model.trim() : envDefaults.model;

    // Si OpenAI está temporalmente bloqueado (p.ej. 429), no hacemos typing ni llamamos.
    if (isOpenAiTemporarilyBlocked()) {
        const info = getOpenAiBlockInfo();
        const seconds = Math.max(0, Math.ceil(((info.untilMs || 0) - Date.now()) / 1000));
        return { ok: false, error: 'openai_temporarily_blocked', details: `retry_in_${seconds}s` };
    }

    // Anti-spam: no responder más de 1 vez cada X ms por canal.
    const channelId = message.channel?.id;
    if (channelId) {
        const now = Date.now();
        const last = lastReplyAtByChannel.get(channelId) || 0;
        if (now - last < effectiveCooldownMs) return { ok: false, reason: 'cooldown' };
        lastReplyAtByChannel.set(channelId, now);
    }

    // Evitar respuestas a mensajes demasiado cortos tipo "ok" (configurable)
    if (content.length < effectiveMinChars) return { ok: false, reason: 'too-short' };

    const messages = await buildConversationFromChannel(message, {
        systemPrompt:
            systemPrompt ||
            (lang && String(lang).startsWith('es')
                ? 'Eres una asistente útil y amable. Responde en español. Sé concisa y clara.'
                : 'You are a helpful assistant. Reply in the user\'s language. Be concise and clear.'),
        historyLimit: effectiveHistoryLimit,
        maxInputChars: effectiveMaxInputChars,
    });

    if (!messages || !messages.length) return { ok: false, reason: 'no-context' };

    // Typing indicator (best-effort) justo antes de la llamada externa
    try { await message.channel.sendTyping(); } catch { }

    const res = await chatCompletion({ messages, model: effectiveModel, temperature: effectiveTemperature });
    if (!res.ok) return res;

    const parts = splitDiscordMessage(res.text, 1900);
    const sent = [];

    // Responder sin pings
    for (let i = 0; i < parts.length; i += 1) {
        const payload = {
            content: parts[i],
            allowedMentions: { parse: [] },
        };

        // primera parte como reply (sin ping)
        if (i === 0) {
            let msg = await message.reply({ ...payload, allowedMentions: { repliedUser: false, parse: [] } }).catch(() => null);
            // Fallback: si reply falla (p.ej. mensaje borrado), intentar enviar normal.
            if (!msg) {
                msg = await message.channel.send(payload).catch(() => null);
            }
            if (msg) sent.push(msg);
        } else {
            const msg = await message.channel.send(payload).catch(() => null);
            if (msg) sent.push(msg);
        }
    }

    if (!sent.length) {
        return { ok: false, error: 'discord_send_failed' };
    }

    return { ok: true, sentCount: sent.length };
}

module.exports = {
    maybeAutoReplyWithAi,
};
