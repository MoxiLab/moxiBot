const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { gamesCategory } = require('../../Util/commandCategories');
const { buildMinesweeperMessageOptions, newGameState } = require('../../Util/minesweeper');

module.exports = {
    cooldown: 0,
    Category: gamesCategory,
    data: new SlashCommandBuilder()
        .setName('minesweeper')
        .setDescription('Inicia una partida de buscaminas')
        .setDMPermission(true),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const state = { ...newGameState(), mode: 'open' };
        return interaction.reply(buildMinesweeperMessageOptions({
            userId: interaction.user?.id,
            lang,
            state,
        }));
    },
};
