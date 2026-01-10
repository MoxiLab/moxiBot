// Comando: Crear regla de auto-moderación
// Requiere permisos de ADMINISTRADOR y un bot con el scope 'applications.commands' y 'bot'
// Usa node-fetch (npm install node-fetch@2)

const fetch = require('node-fetch');
const { ContainerBuilder, MessageFlags } = require('discord.js');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'creaautoregla',
    alias: ['crearreglaauto'],
    description: 'Crea una regla de auto-moderación (palabras prohibidas) en el servidor.',
    usage: 'creaautoregla <palabra>',
    category: 'Moderation',
    cooldown: 10,
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
        const palabra = args[0];
        debugHelper.log('autorulecreate', 'execute start', {
            guildId: message.guildId,
            palabra: palabra || null
        });
        if (!palabra) {
            debugHelper.warn('autorulecreate', 'missing palabra', { guildId: message.guildId });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# ❌ Debes indicar una palabra prohibida.`));
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
        const guildId = message.guild.id;
        const url = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules`;
        const body = {
            name: `Bloqueo: ${palabra}`,
            event_type: 1, // MESSAGE_SEND
            trigger_type: 1, // KEYWORD
            trigger_metadata: { keyword_filter: [palabra] },
            actions: [
                { type: 1, metadata: {} } // Bloquear mensaje
            ],
            enabled: true
        };
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${Moxi.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                debugHelper.warn('autorulecreate', 'api error', { guildId, status: res.status, message: error.message });
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(c => c.setContent(`# ❌ Error al crear la regla: ${(error.message || res.status)}`));
                return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }
            const container = new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# ✅ Regla de auto-moderación creada.`));
            debugHelper.log('autorulecreate', 'rule created', { guildId, palabra });
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (e) {
            debugHelper.error('autorulecreate', 'exception', { guildId: message.guild?.id || 'unknown', error: e.message });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# ❌ Error: ${e.message}`));
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
    }
};
