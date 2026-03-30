
const { MessageFlags } = require('discord.js');
const debugHelper = require('./debugHelper');
const moxi = require('../i18n');
const Config = require('../Config');
const { shouldBlockByTimeGate, buildBlockedMessage } = require('./timeGate');
const { runWithCommandContext } = require('./commandContext');
const { getGuildSettingsCached } = require('./guildSettings');
const { resolveBlacklistBlock, logBlacklistHit } = require('./blacklistStorage');
const { isDiscordOnlyOwner } = require('./ownerPermissions');
const { checkCommandPermissions } = require('./commandPermissions');
const { getMaintenanceStateCached } = require('./maintenanceMode');

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
        }
        else {
            try {
                preview.push(JSON.stringify(arg));
            } catch {
                preview.push(String(arg));
            }
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

async function enqueueCommandPreview({ Moxi, ctx, comando, isInteraction }) {
    try {
        const botId = String(Moxi?.user?.id || process.env.CLIENT_ID || '').trim();
        if (!botId) return;

        const name = String(resolveCommandName(comando) || '').trim().toLowerCase();
        if (!name || name === 'unknown') return;

        const commandType = isInteraction ? 'slash' : 'prefix';

        const guildId = ctx?.guildId || ctx?.guild?.id || null;
        const userId = ctx?.user?.id || ctx?.author?.id || (ctx?.member && ctx.member.user && ctx.member.user.id) || null;

        await enqueuePlaygroundJobInstant(
            'playground:commandPreview',
            {
                name,
                commandType,
                botId,
                guildId,
                userId,
                render: 'v2',
            },
            { botId, guildId, userId, priority: 5 }
        );
    } catch {
        // best-effort
    }
}

async function enqueueCommandRunResult({ Moxi, ctx, comando, isInteraction, ui }) {
    try {
        if (!ui) return;

        const botId = String(Moxi?.user?.id || process.env.CLIENT_ID || '').trim();
        if (!botId) return;

        const name = String(resolveCommandName(comando) || '').trim().toLowerCase();
        if (!name || name === 'unknown') return;

        const commandType = isInteraction ? 'slash' : 'prefix';
        const guildId = ctx?.guildId || ctx?.guild?.id || null;
        const userId = ctx?.user?.id || ctx?.author?.id || (ctx?.member && ctx.member.user && ctx.member.user.id) || null;

        await enqueuePlaygroundResult(
            'playground:commandRun',
            { name, commandType, botId, guildId, userId },
            {
                ok: true,
                kind: 'commandRun',
                botId,
                commandType,
                name,
                ui,
            },
            { botId, guildId, userId, priority: 5 }
        );
    } catch {
        // best-effort
    }
}

function normalizePayload(payload) {
    if (!payload) return null;
    if (typeof payload === 'string') return { content: payload };
    return payload;
}

function createUiCapture(ctx) {
    let lastUi = null;
    const cleanups = [];

    const record = (payload) => {
        const normalized = normalizePayload(payload);
        if (!normalized || !normalized.components) return;
        lastUi = serializeMessagePayload({
            content: normalized.content || '',
            components: normalized.components,
            flags: normalized.flags,
        });
    };

    const wrap = (obj, methodName) => {
        if (!obj || typeof obj[methodName] !== 'function') return;
        const original = obj[methodName];
        obj[methodName] = async function (...args) {
            try { record(args[0]); } catch { }
            return original.apply(this, args);
        };
        cleanups.push(() => { obj[methodName] = original; });
    };

    wrap(ctx, 'reply');
    wrap(ctx, 'editReply');
    wrap(ctx, 'followUp');

    return {
        getUi: () => lastUi,
        restore: () => cleanups.forEach((fn) => fn()),
    };
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

function formatMissingPermissionsMessage({ lang, userMissing, botMissing }) {
    const lines = [];
    const userLabel = moxi.translate('HELP_PERMISSIONS_USER', lang) || 'Usuario';
    const botLabel = moxi.translate('HELP_PERMISSIONS_BOT', lang) || 'Bot';
    const title = moxi.translate('HELP_PERMISSIONS', lang) || 'Permisos';

    if (Array.isArray(userMissing) && userMissing.length > 0) {
        lines.push(`- ${userLabel}: ${userMissing.join(', ')}`);
    }
    if (Array.isArray(botMissing) && botMissing.length > 0) {
        lines.push(`- ${botLabel}: ${botMissing.join(', ')}`);
    }

    const body = lines.length ? lines.join('\n') : '-';
    return `${title} insuficientes:\n${body}`;
}

async function replyBlocked(Moxi, ctx, { content, isInteraction, autoDeleteMs, deleteUserMessage }) {
    if (isInteraction) {
        const payload = { content, flags: MessageFlags.Ephemeral };
        if (ctx.deferred || ctx.replied) return await ctx.followUp(payload).catch(() => null);
        return await ctx.reply(payload).catch(() => null);
    }

    const sent = await ctx.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => null);

    if (deleteUserMessage && ctx && typeof ctx.delete === 'function') {
        try {
            if (typeof ctx.deletable !== 'boolean' || ctx.deletable) {
                await ctx.delete().catch(() => null);
            }
        } catch {
            // ignore
        }
    }

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

async function deleteInvokingMessageBestEffort(ctx) {
    if (!ctx || typeof ctx.delete !== 'function') return;
    try {
        if (typeof ctx.deletable !== 'boolean' || ctx.deletable) {
            await ctx.delete().catch(() => null);
        }
    } catch {
        // ignore
    }
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

async function shouldBlockByMaintenanceGate(Moxi, ctx, comando) {
    const state = await getMaintenanceStateCached();
    if (!state?.enabled) return { shouldBlock: false };

    const commandName = String(resolveCommandName(comando) || '').trim().toLowerCase();
    if (commandName === 'mantenimiento') {
        return { shouldBlock: false };
    }

    const userId = ctx?.user?.id || ctx?.author?.id || (ctx?.member && ctx.member.user && ctx.member.user.id) || null;
    if (userId) {
        const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId }).catch(() => false);
        if (isOwner) return { shouldBlock: false };
    }

    return {
        shouldBlock: true,
        state,
    };
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
    const uiCapture = createUiCapture(ctx);

    try {
        const commandName = String(resolveCommandName(comando) || '').trim().toLowerCase();
        const blacklistBypassCommands = new Set(['blacklist', 'gblacklist']);

        if (!blacklistBypassCommands.has(commandName)) {
            const guildId = ctx?.guildId || ctx?.guild?.id || null;
            const userId = ctx?.user?.id || ctx?.author?.id || (ctx?.member && ctx.member.user && ctx.member.user.id) || null;

            if (userId) {
                const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId }).catch(() => false);

                if (!isOwner) {
                    const roleIds = Array.from(ctx?.member?.roles?.cache?.keys?.() || []);
                    const block = await resolveBlacklistBlock({
                        guildId,
                        userId,
                        action: 'command',
                        commandName,
                        roleIds,
                    });
                    if (block?.blocked && block.entry) {
                        const lang = await getLangForCtx(ctx);
                        const t = (key, fallback) => {
                            const out = moxi.translate(key, lang);
                            return (out && out !== key) ? out : fallback;
                        };

                        const details = [];
                        if (block.entry.reason) {
                            details.push(`${t('misc:BLACKLIST_REASON', 'Motivo')}: ${block.entry.reason}`);
                        }
                        if (typeof block.entry.level === 'number') {
                            details.push(`${t('misc:BLACKLIST_LEVEL', 'Nivel')}: ${block.entry.level}`);
                        }
                        if (block.entry.expiresAt) {
                            const ts = Math.floor(new Date(block.entry.expiresAt).getTime() / 1000);
                            if (ts) {
                                details.push(`${t('misc:BLACKLIST_EXPIRES', 'Expira')}: <t:${ts}:R>`);
                            }
                        }

                        let content = '';
                        if (block.targetType === 'guild') {
                            content = t('misc:BLACKLIST_GUILD_BLOCKED', 'Este servidor está en blacklist global y no puedes usar comandos aquí.');
                        } else if (block.scope === 'global') {
                            content = t('misc:BLACKLIST_GLOBAL_BLOCKED', 'Estás en blacklist global y no puedes usar comandos.');
                        } else {
                            content = t('misc:BLACKLIST_LOCAL_BLOCKED', 'Estás en blacklist de este servidor y no puedes usar comandos.');
                        }

                        if (details.length) content += `\n${details.join('\n')}`;

                        await logBlacklistHit({
                            client: Moxi,
                            userId,
                            guildId,
                            action: 'command',
                            source: isInteraction ? 'interaction' : 'message',
                            commandName,
                            entry: block.entry,
                        });

                        return await replyBlocked(Moxi, ctx, {
                            content,
                            isInteraction,
                        });
                    }
                }
            }
        }
    } catch {
        // best-effort
    }

    // --- ECONOMY GATE (canal dedicado / toggle) ---
    try {
        const maintenance = await shouldBlockByMaintenanceGate(Moxi, ctx, comando);
        if (maintenance?.shouldBlock) {
            const state = maintenance.state || {};
            const reason = (typeof state.reason === 'string' ? state.reason.trim() : '');
            const content = reason
                ? `El bot esta en mantenimiento.\nMotivo: ${reason}`
                : 'El bot esta en mantenimiento. Intentalo de nuevo en unos minutos.';
            return await replyBlocked(Moxi, ctx, { content, isInteraction });
        }
    } catch {
        // best-effort: si falla el gate, no bloqueamos
    }

    try {
        const perms = await checkCommandPermissions({ client: Moxi, ctx, command: comando });
        if (perms?.blocked) {
            const lang = await getLangForCtx(ctx);
            const content = formatMissingPermissionsMessage({
                lang,
                userMissing: perms.userMissing,
                botMissing: perms.botMissing,
            });
            return await replyBlocked(Moxi, ctx, { content, isInteraction });
        }
    } catch {
        // best-effort
    }

    try {
        const gate = await shouldBlockByEconomyGate(ctx, comando);
        if (gate?.shouldBlock) {
            const lang = await getLangForCtx(ctx);
            const guildId = ctx?.guildId || ctx?.guild?.id || null;
            const channelId = ctx?.channelId || ctx?.channel?.id || null;
            const userId = ctx?.user?.id || ctx?.author?.id || (ctx?.member && ctx.member.user && ctx.member.user.id) || null;

            // Para comandos con prefijo: aunque suprimamos el aviso por rate-limit,
            // aún intentamos borrar el mensaje del usuario (si tenemos permisos).
            if (!isInteraction && (gate.kind === 'economy-wrong-channel' || gate.kind === 'non-economy-in-econ-channel')) {
                await deleteInvokingMessageBestEffort(ctx);
            }

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
                return await replyBlocked(Moxi, ctx, {
                    content: msg,
                    isInteraction,
                    autoDeleteMs: isInteraction ? 0 : ECON_GATE_AUTO_DELETE_MS,
                    deleteUserMessage: !isInteraction,
                });
            }
            if (gate.kind === 'non-economy-in-econ-channel') {
                const msg = moxi.translate('misc:ECONOMY_GATE_ECONOMY_ONLY_CHANNEL', lang) || 'Este canal es solo para comandos de economía.';
                return await replyBlocked(Moxi, ctx, {
                    content: msg,
                    isInteraction,
                    autoDeleteMs: isInteraction ? 0 : ECON_GATE_AUTO_DELETE_MS,
                    deleteUserMessage: !isInteraction,
                });
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

    let execResult;
    try {
        if (typeof comando.execute === 'function') {
            execResult = await runWithCommandContext(context, () => comando.execute(Moxi, ctx, args));
            return execResult;
        }
        if (typeof comando.run === 'function') {
            execResult = await runWithCommandContext(context, () => comando.run(Moxi, ctx, args));
            return execResult;
        }

        throw new Error('El comando no tiene función ejecutable (execute o run)');
    } finally {
        const ui = uiCapture.getUi();
        uiCapture.restore();
        await enqueueCommandRunResult({ Moxi, ctx, comando, isInteraction, ui });
    }
};
