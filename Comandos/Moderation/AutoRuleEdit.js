// Comando: Editar (activar/desactivar) una regla de auto-moderación
const fetch = require('node-fetch');
const { ContainerBuilder, MessageFlags } = require('discord.js');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'editaautoregla',
    alias: ['editarreglaauto'],
    description: 'Activa o desactiva una regla de auto-moderación por ID.',
    usage: 'editaautoregla <id> <on|off>',
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
        debugHelper.log('autoruleedit', 'execute start', {
            guildId: message.guildId,
            ruleId: id || null,
            action: action || null
        });
        if (!id || !['on', 'off'].includes((action || '').toLowerCase())) {
            debugHelper.warn('autoruleedit', 'invalid args', { guildId: message.guildId, provided: args.slice(0, 2) });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# ❌ Uso: editaautoregla <id> <on|off>`));
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
        const enabled = action.toLowerCase() === 'on';
        const guildId = message.guild.id;
        const url = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules/${id}`;
        try {
            const res = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bot ${Moxi.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled })
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                debugHelper.warn('autoruleedit', 'api error', { guildId, ruleId: id, status: res.status, message: error.message });
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(c => c.setContent(`# ❌ Error al editar: ${(error.message || res.status)}`));
                return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }
            const container = new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# ✅ Regla ${enabled ? 'activada' : 'desactivada'}.`));
            debugHelper.log('autoruleedit', 'rule toggled', { guildId, ruleId: id, enabled });
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (e) {
            debugHelper.error('autoruleedit', 'exception', { guildId: message.guild?.id || 'unknown', ruleId: id, error: e.message });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# ❌ Error: ${e.message}`));
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
    }
};
