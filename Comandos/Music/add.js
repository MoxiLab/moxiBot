// Comando de prefijo: add
// Reutiliza la lógica del subcomando "add" de musica.js (slash)

const musica = require('../../Slashcmd/Musica/musica.js');

const moxi = require('../../i18n.js');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: "add",
    alias: ["añadir", "sumar", "agregar"],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_MUSICA', lang);
    },
    usage: 'add <cantidad>',
    description: function (lang) { return moxi.translate('commands:CMD_add_DESC', lang || 'es-ES'); },
    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const guildId = message.guild?.id;
        const requesterId = message.author?.id;
        debugHelper.log('add', 'prefix execute start', { guildId, requesterId, args: args.slice(0, 2) });

        const cantidad = args[0] ? Number(args[0]) : undefined;
        if (!cantidad || isNaN(cantidad)) {
            debugHelper.warn('add', 'invalid amount', { guildId, requesterId, input: args[0] });
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('MUSIC_ADD_AMOUNT_REQUIRED', lang) })
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
                getSubcommand: () => 'add',
                getInteger: (name) => name === 'cantidad' ? cantidad : undefined
            },
            reply: async (payload) => message.reply(payload),
            editReply: async (payload) => message.reply(payload),
            deferReply: async () => { },
            lang,
        };
        await musica.run(Moxi, fakeInteraction);
    }
};
