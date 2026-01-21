
const { MessageFlags } = require('discord.js');
const debugHelper = require('./debugHelper');
const moxi = require('../i18n');
const Config = require('../Config');
const { shouldBlockByTimeGate, buildBlockedMessage } = require('./timeGate');
const { runWithCommandContext } = require('./commandContext');
const { getGuildSettingsCached } = require('./guildSettings');

const ECON_GATE_NOTICE_TTL_MS = Number.parseInt(process.env.ECON_GATE_NOTICE_TTL_MS || '', 10) || 12_000;
const ECON_GATE_AUTO_DELETE_MS = Number.parseInt(process.env.ECON_GATE_AUTO_DELETE_MS || '', 10) || 10_000;
const econGateNoticeCache = new Map(); // key -> lastAt

function shouldSuppressEconGateNotice({ guildId, channelId, userId, kind }) {
    if (!guildId || !channelId || !userId || !kind) return false;
    const key = `${guildId}:${channelId}:${userId}:${kind}`;
    const now = Date.now();
    const lastAt = econGateNoticeCache.get(key) || 0;
    if (now - lastAt < ECON_GATE_NOTICE_TTL_MS) return true;
    econGateNoticeCache.set(key, now);

    // best-effort cleanup
    if (econGateNoticeCache.size > 2000) {
        const cutoff = now - (ECON_GATE_NOTICE_TTL_MS * 3);
        for (const [k, t] of econGateNoticeCache) {
            if (t < cutoff) econGateNoticeCache.delete(k);
        }
    }
    return false;
}

function resolveCommandName(comando) {
    if (!comando) return 'unknown';
    if (typeof comando.name === 'string' && comando.name) return comando.name;
    if (comando.data && typeof comando.data.name === 'string' && comando.data.name) return comando.data.name;
    return 'unknown';
}

function summarizeArgs(args) {
    if (!Array.isArray(args) || args.length === 0) return null;
    const preview = [];
    const limit = Math.min(3, args.length);
    for (let i = 0; i < limit; i += 1) {
        const arg = args[i];
        if (typeof arg === 'string') {
            preview.push(arg);
            continue;
        }
        try {
            preview.push(JSON.stringify(arg));
        } catch {
            preview.push(String(arg));
        }
    }
    return preview.join(' | ');
}

function buildContextPayload(ctx, comando, args, isInteraction) {
    const guildId = ctx?.guildId || ctx?.guild?.id || (ctx?.message && ctx.message.guildId) || 'dm';
    const memberUserId = ctx?.member?.user?.id;
    const userId = ctx?.user?.id || ctx?.author?.id || memberUserId || 'unknown';
    const summaryArgs = summarizeArgs(args);
    const payload = {
        command: resolveCommandName(comando),
        source: isInteraction ? 'interaction' : 'message',
        guildId,
        userId,
        argsCount: Array.isArray(args) ? args.length : 0,
    };
    if (summaryArgs) payload.argPreview = summaryArgs;
    return payload;
}

function isEconomyCommand(comando) {
    const source = comando && comando.__sourceFile ? String(comando.__sourceFile) : '';
    if (!source) return false;
    return /(?:^|[\\/])(?:Comandos|Slashcmd)(?:[\\/])Economy(?:[\\/])/i.test(source);
}

function getExecutorInfo(ctx) {
    const user = ctx?.user || ctx?.author || (ctx?.member && ctx.member.user) || null;
    if (!user) return { userId: null, tag: null };
    const userId = user.id ? String(user.id) : null;
    const tag = user.tag ? String(user.tag) : (user.username ? String(user.username) : null);
    return { userId, tag };
}

async function getLangForCtx(ctx) {
    const fallback = process.env.DEFAULT_LANG || 'es-ES';
    const direct = ctx?.lang;
    if (direct && typeof direct === 'string') return direct;
    const guildId = ctx?.guildId || ctx?.guild?.id || null;
    if (!guildId || !moxi.guildLang) return fallback;
    try {
        return await moxi.guildLang(guildId, fallback);
    } catch {
        return fallback;
    }
}

async function replyBlocked(Moxi, ctx, { content, isInteraction, autoDeleteMs }) {
    if (isInteraction) {
        const payload = { content, flags: MessageFlags.Ephemeral };
        if (ctx.deferred || ctx.replied) return await ctx.followUp(payload).catch(() => null);
        return await ctx.reply(payload).catch(() => null);
    }

    const sent = await ctx.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => null);
    const ms = Number.isFinite(autoDeleteMs) ? autoDeleteMs : 0;
    if (sent && ms > 0) {
        setTimeout(() => {
            try {
                sent.delete().catch(() => null);
            } catch {
                // ignore
            }
        }, ms);
    }
    return sent;
}

async function shouldBlockByEconomyGate(ctx, comando) {
    const guildId = ctx?.guildId || ctx?.guild?.id || null;
    if (!guildId) return { shouldBlock: false };

    // IMPORTANTE: el comando de configuración `economy` debe poder ejecutarse siempre,
    // incluso dentro del canal exclusivo, para evitar dejar al server "bloqueado".
    try {
        const cmdName = String(resolveCommandName(comando) || '').trim().toLowerCase();
        if (cmdName === 'economy') return { shouldBlock: false };
    } catch {
        // ignore
    }

    const settings = await getGuildSettingsCached(guildId).catch(() => null);
    if (settings && ctx?.guild) ctx.guild.settings = settings;

    const enabled = (typeof settings?.EconomyEnabled === 'boolean') ? settings.EconomyEnabled : true;
    const economyChannelId = settings?.EconomyChannelId ? String(settings.EconomyChannelId) : '';
    const exclusive = (typeof settings?.EconomyExclusive === 'boolean')
        ? settings.EconomyExclusive
        : !!economyChannelId;

    const channelId = ctx?.channelId || ctx?.channel?.id || null;
    const isEco = isEconomyCommand(comando);

    // Economía desactivada
    if (isEco && enabled === false) {
        return { shouldBlock: true, kind: 'economy-disabled', economyChannelId };
    }

    // Economía solo en un canal
    if (isEco && economyChannelId && channelId && String(channelId) !== economyChannelId) {
        return { shouldBlock: true, kind: 'economy-wrong-channel', economyChannelId };
    }

    // Canal exclusivo de economía: nada que no sea economy
    if (!isEco && exclusive && economyChannelId && channelId && String(channelId) === economyChannelId) {
        return { shouldBlock: true, kind: 'non-economy-in-econ-channel', economyChannelId };
    }

    return { shouldBlock: false };
}

// Handler global para comandos prefix y slash
// Uso: require y llama a handleCommand(client, ctx, args, comando)

module.exports = async function handleCommand(Moxi, ctx, args, comando) {
    // ctx: message (prefix) o interaction (slash)
    // comando: objeto del comando (de Comandos o Slashcmd)
    // args: array de argumentos (puede ser vacío para slash)

    const isInteraction = !!(ctx?.isCommand?.() || ctx?.isContextMenuCommand?.() || ctx?.isChatInputCommand?.());
    if (isInteraction) ctx.isInteraction = true;

    debugHelper.log('commands', 'invoke', buildContextPayload(ctx, comando, args, isInteraction));

    // --- ECONOMY GATE (canal dedicado / toggle) ---
    try {
        const gate = await shouldBlockByEconomyGate(ctx, comando);
        if (gate?.shouldBlock) {
            const lang = await getLangForCtx(ctx);
            const guildId = ctx?.guildId || ctx?.guild?.id || null;
            const channelId = ctx?.channelId || ctx?.channel?.id || null;
            const userId = ctx?.user?.id || ctx?.author?.id || (ctx?.member && ctx.member.user && ctx.member.user.id) || null;

            if (shouldSuppressEconGateNotice({ guildId, channelId, userId, kind: gate.kind })) {
                return null;
            }

            if (gate.kind === 'economy-disabled') {
                const msg = moxi.translate('misc:ECONOMY_GATE_DISABLED', lang) || 'Economía desactivada.';
                return await replyBlocked(Moxi, ctx, { content: msg, isInteraction });
            }
            if (gate.kind === 'economy-wrong-channel') {
                const msg = moxi.translate('misc:ECONOMY_GATE_ONLY_CHANNEL', lang, {
                    channel: gate.economyChannelId ? `<#${gate.economyChannelId}>` : '#economy',
                }) || `Este comando solo se puede usar en ${gate.economyChannelId ? `<#${gate.economyChannelId}>` : 'el canal de economía'}.`;
                return await replyBlocked(Moxi, ctx, { content: msg, isInteraction, autoDeleteMs: isInteraction ? 0 : ECON_GATE_AUTO_DELETE_MS });
            }
            if (gate.kind === 'non-economy-in-econ-channel') {
                const msg = moxi.translate('misc:ECONOMY_GATE_ECONOMY_ONLY_CHANNEL', lang) || 'Este canal es solo para comandos de economía.';
                return await replyBlocked(Moxi, ctx, { content: msg, isInteraction });
            }
        }
    } catch {
        // best-effort: si falla el gate, no bloqueamos
    }
    // --- FIN ECONOMY GATE ---

    // --- TIME GATE (bloqueo por horario) ---
    try {
        const commandName = resolveCommandName(comando);
        const gate = shouldBlockByTimeGate({ ctx, commandName, commandObj: comando, config: Config });
        if (gate?.shouldBlock) {
            const tz = gate?.gate?.timezone || Config?.TimeGates?.timezone;
            const msg = buildBlockedMessage({
                windows: gate?.gate?.windows,
                timezone: tz,
                publicDuringWindows: gate?.gate?.publicDuringWindows,
            });

            if (isInteraction) {
                const payload = { content: msg, flags: MessageFlags.Ephemeral };
                if (ctx.deferred || ctx.replied) return await ctx.followUp(payload).catch(() => null);
                return await ctx.reply(payload).catch(() => null);
            }

            return await ctx.reply({ content: msg, allowedMentions: { repliedUser: false } }).catch(() => null);
        }
    } catch {
        // no-op (si falla el gate, no bloqueamos)
    }
    // --- FIN TIME GATE ---

    // --- REGISTRO Y ENVÍO AL CANAL DE LOGS DE COMANDOS ---
    try {
        const channelId = '1459940703319625779';
        const channel = await Moxi.channels.fetch(channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
            const user = ctx.user || ctx.author || (ctx.member && ctx.member.user);
            const username = user ? user.username : 'Unknown';
            const commandName = resolveCommandName(comando);
            const guildName = (ctx.guild && ctx.guild.name) ? ctx.guild.name : 'DM';
            // Obtener idioma de la guild (o default)
            let lang = 'es-ES';
            if (ctx.guild && ctx.guild.id && moxi.guildLang) {
                try {
                    lang = await moxi.guildLang(ctx.guild.id, 'es-ES');
                } catch { }
            }
            const embed = {
                color: 0xE1A6FF,
                title: moxi.translate('commands:LOG_COMMAND_TITLE', lang) || '📥 Comando ejecutado',
                description:
                    (moxi.translate('commands:LOG_COMMAND_DESC', lang, {
                        command: commandName,
                        user: username,
                        guild: guildName
                    }) ||
                        '**Comando:** `' + commandName + '`\n**Usuario:** ' + username + '\n**Servidor:** ' + guildName),
                timestamp: new Date().toISOString(),
            };
            channel.send({ embeds: [embed] }).catch(() => { });
        }
    } catch { }
    // --- FIN REGISTRO ---

    // Preferir `execute` (API estable) y luego `run` como fallback.
    const { userId, tag } = getExecutorInfo(ctx);
    const context = {
        command: resolveCommandName(comando),
        sourceFile: comando && comando.__sourceFile ? String(comando.__sourceFile) : null,
        isEconomy: isEconomyCommand(comando),
        userId,
        userTag: tag,
    };

    if (typeof comando.execute === 'function') {
        return runWithCommandContext(context, () => comando.execute(Moxi, ctx, args));
    }
    if (typeof comando.run === 'function') {
        return runWithCommandContext(context, () => comando.run(Moxi, ctx, args));
    }

    throw new Error('El comando no tiene función ejecutable (execute o run)');
};
