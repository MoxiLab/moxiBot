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
        .setName('daily')
        .setDescription('Comando en desarrollo'),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/daily:${k}`, lang, vars);
        return interaction.reply({
            ...buildWipPayload({
                title: t('TITLE'),
                text: t('WIP_TEXT'),
            }),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
