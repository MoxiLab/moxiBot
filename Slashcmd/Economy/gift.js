const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildWipPayload } = require('../../Util/wip');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription('Comando en desarrollo'),

    async run(Moxi, interaction) {
        return interaction.reply({
            ...buildWipPayload({
                title: 'Gift',
                text: 'Este comando aún está en desarrollo. Lo añadiremos pronto.',
            }),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
