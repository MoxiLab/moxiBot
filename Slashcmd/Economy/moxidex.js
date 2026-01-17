const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildMoxidexMessage } = require('../../Util/moxidexView');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('moxidex')
        .setDescription('Muestra tu Moxidex (mascotas)'),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const payload = await buildMoxidexMessage({
            userId: interaction.user.id,
            viewerId: interaction.user.id,
            tierKey: 'all',
            sort: 'new',
            page: 0,
            lang,
        });

        return interaction.reply(payload);
    },
};
