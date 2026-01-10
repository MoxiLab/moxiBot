// Comando: Eliminar regla de auto-moderación
const fetch = require('node-fetch');
const { ContainerBuilder, MessageFlags } = require('discord.js');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'eliminautoregla',
    alias: ['borrarreglaauto'],
    description: 'Elimina una regla de auto-moderación por ID.',
    usage: 'eliminautoregla <id>',
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
        debugHelper.log('autoruledelete', 'execute start', { guildId: message.guildId, ruleId: id || null });
        if (!id) {
            debugHelper.warn('autoruledelete', 'missing id', { guildId: message.guildId });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# ❌ Debes indicar el ID de la regla.`));
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
        const guildId = message.guild.id;
        const url = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules/${id}`;
        try {
            const res = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `Bot ${Moxi.token}` }
            });
            if (res.status === 204) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(c => c.setContent(`# ✅ Regla eliminada.`));
                debugHelper.log('autoruledelete', 'rule deleted', { guildId, ruleId: id });
                return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }
            const error = await res.json().catch(() => ({}));
            debugHelper.warn('autoruledelete', 'api error', { guildId, ruleId: id, status: res.status, message: error.message });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# ❌ Error al eliminar: ${(error.message || res.status)}`));
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (e) {
            debugHelper.error('autoruledelete', 'exception', { guildId: message.guild?.id || 'unknown', ruleId: id, error: e.message });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# ❌ Error: ${e.message}`));
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
    }
};
