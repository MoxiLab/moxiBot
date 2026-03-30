const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { gamesCategory } = require('../../Util/commandCategories');
const { buildMinesweeperMessageOptions, newGameState } = require('../../Util/minesweeper');

module.exports = {
    name: 'minesweeper',
    alias: ['minesweeper', 'buscaminas', 'msw'],
    Category: gamesCategory,
    usage: 'minesweeper',
    description: 'commands:CMD_MINESWEEPER_DESC',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        try {
            const state = { ...newGameState(), mode: 'open' };
            return message.reply({
                ...buildMinesweeperMessageOptions({ userId: message.author?.id, lang, state }),
                allowedMentions: { repliedUser: false },
            });
        } catch {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({
                    emoji: '🧩',
                    title: 'Buscaminas',
                    text: 'No pude iniciar el juego ahora mismo.',
                })),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
