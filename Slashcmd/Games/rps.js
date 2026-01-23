const { SlashCommandBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { gamesCategory } = require('../../Util/commandCategories');
const { buildRpsMessageOptions } = require('../../Util/rpsGame');

module.exports = {
    cooldown: 0,
    Category: gamesCategory,
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Piedra, papel o tijera')
        .setDMPermission(true),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        return interaction.reply(buildRpsMessageOptions({
            userId: interaction.user?.id,
            lang,
        }));
    },
};
