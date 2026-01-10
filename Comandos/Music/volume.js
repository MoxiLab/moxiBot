// Comando de prefijo: volume
// Reutiliza la lógica del subcomando "volume" de musica.js (slash)

const musica = require('../../Slashcmd/Musica/musica.js');

const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: "volume",
    alias: ["vol", "v"],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_MUSICA', lang);
    },
    usage: 'volume <cantidad>',
    description: function (lang) { return moxi.translate('commands:CMD_VOLUME_DESC', lang || 'es-ES'); },
    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        const requesterId = message.author?.id;
        debugHelper.log('volume', 'prefix execute start', { guildId, requesterId, args: args.slice(0, 2) });
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const amount = args[0] ? Number(args[0]) : undefined;
        if (!amount || isNaN(amount)) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('MUSIC_VOLUME_NUMBER_REQUIRED', lang) })
                )
            );
        }
        const fakeInteraction = {
            guild: message.guild,
            guildId: message.guild.id,
            member: message.member,
            channel: message.channel,
            user: message.author,
            options: {
                getSubcommand: () => 'volume',
                getNumber: (name) => name === 'amount' ? amount : undefined
            },
            reply: async (payload) => message.reply(payload),
            editReply: async (payload) => message.reply(payload),
            deferReply: async () => { },
            lang,
        };
        await musica.run(Moxi, fakeInteraction);
    }
};
