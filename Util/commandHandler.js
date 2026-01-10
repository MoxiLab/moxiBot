const debugHelper = require('./debugHelper');

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

module.exports = function handleCommand(Moxi, ctx, args, comando) {
    // ctx: message (prefix) o interaction (slash)
    // comando: objeto del comando (de Comandos o Slashcmd)
    // args: array de argumentos (puede ser vacío para slash)

    const isInteraction = !!(ctx?.isCommand?.() || ctx?.isContextMenuCommand?.() || ctx?.isChatInputCommand?.());
    if (isInteraction) ctx.isInteraction = true;

    debugHelper.log('commands', 'invoke', buildContextPayload(ctx, comando, args, isInteraction));

    // Preferir `execute` (API estable) y luego `run` como fallback.
    if (typeof comando.execute === 'function') return comando.execute(Moxi, ctx, args);
    if (typeof comando.run === 'function') return comando.run(Moxi, ctx, args);

    throw new Error('El comando no tiene función ejecutable (execute o run)');
};
