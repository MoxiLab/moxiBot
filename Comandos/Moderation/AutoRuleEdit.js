// Comando: Editar (activar/desactivar) una regla de auto-moderación
const fetch = require('node-fetch');
const debugHelper = require('../../Util/debugHelper');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');

module.exports = {
    name: 'amtgl',
    alias: ['editaautoregla', 'editarreglaauto', 'automodtoggle', 'amtoggle'],
    description: 'Activa o desactiva una regla de auto-moderación por ID.',
    usage: 'amtgl <id> <on|off>',
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
    async execute(Moxi, message, args) {
        const id = args[0];
        const action = args[1];
        const rest = args.slice(2);
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
        debugHelper.log('autoruleedit', 'execute start', {
            guildId: message.guildId,
            ruleId: id || null,
            action: action || null,
            hasReason: Boolean(reason)
        });
        if (!id || !['on', 'off'].includes((action || '').toLowerCase())) {
            debugHelper.warn('autoruleedit', 'invalid args', { guildId: message.guildId, provided: args.slice(0, 2) });
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'AutoMod',
                text: 'Uso: amtgl <id> <on|off> [--reason MOTIVO]',
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            return message.reply(asV2MessageOptions(container));
        }
        const enabled = action.toLowerCase() === 'on';
        const guildId = message.guild.id;
        const url = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules/${id}`;
        try {
            const headers = {
                'Authorization': `Bot ${Moxi.token}`,
                'Content-Type': 'application/json'
            };
            if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);
            const res = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ enabled })
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                debugHelper.warn('autoruleedit', 'api error', { guildId, ruleId: id, status: res.status, message: error.message });
                const container = buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: 'AutoMod',
                    text: `Error al editar: ${(error.message || res.status)}`,
                    footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
                });
                return message.reply(asV2MessageOptions(container));
            }
            const container = buildNoticeContainer({
                emoji: EMOJIS.check,
                title: 'AutoMod',
                text: `Regla ${enabled ? 'activada' : 'desactivada'}.`,
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            debugHelper.log('autoruleedit', 'rule toggled', { guildId, ruleId: id, enabled });
            return message.reply(asV2MessageOptions(container));
        } catch (e) {
            debugHelper.error('autoruleedit', 'exception', { guildId: message.guild?.id || 'unknown', ruleId: id, error: e.message });
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
