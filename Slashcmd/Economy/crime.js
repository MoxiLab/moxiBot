const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildCrimeMessageOptions } = require('../../Util/crimeView');

function economyCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
}

module.exports = {
    cooldown: 0,
    Category: economyCategory,
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Comete un crimen para intentar ganar monedas (con riesgo)'),

    async run(Moxi, interaction) {
        const userId = interaction.user?.id;
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const payload = buildCrimeMessageOptions({ lang, userId });
        return interaction.reply({ ...payload, flags: payload.flags & ~MessageFlags.Ephemeral });
    },
};
