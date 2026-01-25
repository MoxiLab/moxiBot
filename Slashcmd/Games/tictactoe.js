const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { gamesCategory } = require('../../Util/commandCategories');
const { buildTttMessageOptions } = require('../../Util/tictactoe');

module.exports = {
    cooldown: 0,
    Category: gamesCategory,
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Tres en raya (vs bot)')
        .setDescriptionLocalizations({
            'en-US': 'Tic-tac-toe (vs bot)',
            'es-ES': 'Tres en raya (vs bot)',
            'de': 'Tic-Tac-Toe (gegen Bot)',
            'fr': 'Morpion (contre le bot)',
            'it': 'Tris (contro il bot)',
            'ja': '三目並べ（ボット対戦）',
            'ko': '틱택토 (봇 대전)',
            'zh-CN': '井字棋（对战机器人）',
            'hi': 'टिक-टैक-टो (बॉट के खिलाफ)',
            'id': 'Tic-tac-toe (vs bot)',
        })
        .setDMPermission(true),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        return interaction.reply(buildTttMessageOptions({
            userId: interaction.user?.id,
            lang,
            board: Array(9).fill(0),
        }));
    },
};
