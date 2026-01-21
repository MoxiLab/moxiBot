const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { gamesCategory } = require('../../Util/commandCategories');
const { buildTttMessageOptions } = require('../../Util/tictactoe');

module.exports = {
    name: 'tictactoe',
    alias: ['tictactoe', 'ttt', '3enraya', 'tresenraya'],
    Category: gamesCategory,
    usage: 'tictactoe',
    description: 'commands:CMD_TICTACTOE_DESC',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        try {
            return message.reply({
                ...buildTttMessageOptions({ userId: message.author?.id, lang, board: Array(9).fill(0) }),
                allowedMentions: { repliedUser: false },
            });
        } catch {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({
                    emoji: '🕹️',
                    title: 'Tres en raya',
                    text: 'No pude iniciar el juego ahora mismo.',
                })),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
