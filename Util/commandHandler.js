
const { MessageFlags } = require('discord.js');
const debugHelper = require('./debugHelper');
const moxi = require('../i18n');
const Config = require('../Config');
const { shouldBlockByTimeGate, buildBlockedMessage } = require('./timeGate');

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

// Handler global para comandos prefix y slash
// Uso: require y llama a handleCommand(client, ctx, args, comando)

module.exports = async function handleCommand(Moxi, ctx, args, comando) {
    // ctx: message (prefix) o interaction (slash)
    // comando: objeto del comando (de Comandos o Slashcmd)
    // args: array de argumentos (puede ser vacío para slash)

    const isInteraction = !!(ctx?.isCommand?.() || ctx?.isContextMenuCommand?.() || ctx?.isChatInputCommand?.());
    if (isInteraction) ctx.isInteraction = true;

    debugHelper.log('commands', 'invoke', buildContextPayload(ctx, comando, args, isInteraction));

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
    if (typeof comando.execute === 'function') return comando.execute(Moxi, ctx, args);
    if (typeof comando.run === 'function') return comando.run(Moxi, ctx, args);

    throw new Error('El comando no tiene función ejecutable (execute o run)');
};
