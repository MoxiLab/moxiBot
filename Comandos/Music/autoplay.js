// Comando de prefijo: autoplay
// Reutiliza la lógica del subcomando "autoplay" de musica.js (slash)

const musica = require('../../Slashcmd/Musica/musica.js');

const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: "autoplay",
    alias: ["ap", "reproduccionautomatica", "reproducciónautomática"],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_MUSICA', lang);
    },
    usage: 'autoplay <plataforma>',
    get description() { return moxi.translate('commands:CMD_AUTOPLAY_DESC', 'es-ES'); },
    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const guildId = message.guild?.id;
        const requesterId = message.author?.id;
        const platform = args[0] || 'yt';
        debugHelper.log('autoplay', 'prefix execute start', { guildId, requesterId, platform });
        const fakeInteraction = {
            guild: message.guild,
            guildId: message.guild.id,
            member: message.member,
            channel: message.channel,
            user: message.author,
            options: {
                getSubcommand: () => 'autoplay',
                getString: (name) => name === 'platform' ? platform : undefined
            },
            reply: async (payload) => message.reply(payload),
            editReply: async (payload) => message.reply(payload),
            deferReply: async () => { },
            lang,
        };
        await musica.run(Moxi, fakeInteraction);
    }
};
