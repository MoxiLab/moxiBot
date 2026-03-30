// Comando: Eliminar regla de auto-moderación
const fetch = require('node-fetch');
const debugHelper = require('../../Util/debugHelper');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');

module.exports = {
    name: 'amdel',
    alias: ['eliminautoregla', 'borrarreglaauto', 'automoddel', 'amdelete'],
    description: 'Elimina una regla de auto-moderación por ID.',
    usage: 'amdel <id>',
    category: 'Moderation',
    cooldown: 5,
    permissions: {
        user: ['Administrator'],
        bot: ['Administrator'],
        role: []
    },
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
        options: []
    },
    execute: async (Moxi, message, args) => {
        const id = args[0];
        const rest = args.slice(1);
        const idx = rest.findIndex(x => String(x || '').toLowerCase().startsWith('--reason'));
        let reason = '';
        if (idx !== -1) {
            const token = String(rest[idx] || '');
            const inline = token.includes('=') ? token.split('=').slice(1).join('=') : '';
            if (inline) {
                reason = String(inline).trim();
            } else {
                const parts = rest.slice(idx + 1).filter(t => !String(t).startsWith('--'));
                reason = String(parts.join(' ')).trim();
            }
        } else if (rest.length) {
            reason = String(rest.join(' ')).trim();
        }
        debugHelper.log('autoruledelete', 'execute start', { guildId: message.guildId, ruleId: id || null });
        if (!id) {
            debugHelper.warn('autoruledelete', 'missing id', { guildId: message.guildId });
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'AutoMod',
                text: 'Debes indicar el ID de la regla.',
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            return message.reply(asV2MessageOptions(container));
        }
        const guildId = message.guild.id;
        const url = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules/${id}`;
        try {
            const headers = { 'Authorization': `Bot ${Moxi.token}` };
            if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);
            const res = await fetch(url, {
                method: 'DELETE',
                headers
            });
            if (res.status === 204) {
                const container = buildNoticeContainer({
                    emoji: EMOJIS.check,
                    title: 'AutoMod',
                    text: 'Regla eliminada.',
                    footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
                });
                debugHelper.log('autoruledelete', 'rule deleted', { guildId, ruleId: id });
                return message.reply(asV2MessageOptions(container));
            }
            const error = await res.json().catch(() => ({}));
            debugHelper.warn('autoruledelete', 'api error', { guildId, ruleId: id, status: res.status, message: error.message });
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'AutoMod',
                text: `Error al eliminar: ${(error.message || res.status)}`,
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            return message.reply(asV2MessageOptions(container));
        } catch (e) {
            debugHelper.error('autoruledelete', 'exception', { guildId: message.guild?.id || 'unknown', ruleId: id, error: e.message });
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'AutoMod',
                text: `Error: ${e.message}`,
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            return message.reply(asV2MessageOptions(container));
        }
    }
};
