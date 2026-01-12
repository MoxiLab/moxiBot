const Guild = require('../../Models/GuildSchema');

module.exports = {
    name: 'logs',
    alias: ['setlogs', 'logschannel'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'logs set #canal',
    description: 'Configura el canal de logs general para el servidor.',
    async execute(Moxi, message, args) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('Necesitas permisos de administrador para usar este comando.');
        }
        if (!args[0] || !args[1] || args[0].toLowerCase() !== 'set') {
            return message.reply('Uso: logs set #canal');
        }
        const channelMention = args[1];
        const channelId = channelMention.replace(/[^0-9]/g, '');
        const channel = message.guild.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) {
            return message.reply('Canal no válido.');
        }
        await Guild.updateOne(
            { guildID: message.guild.id },
            { $set: { logChannelID: channelId } },
            { upsert: true }
        );
        return message.reply(`Canal de logs configurado: <#${channelId}>`);
    }
};
