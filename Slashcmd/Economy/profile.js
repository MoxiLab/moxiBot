const { ChatInputCommandBuilder: SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildWipPayload } = require('../../Util/wip');
const { WIP_SLASH_DESC, WIP_SLASH_DESC_LOCALIZATIONS } = require('../../Util/slashI18n');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription(WIP_SLASH_DESC)
        .setDescriptionLocalizations(WIP_SLASH_DESC_LOCALIZATIONS),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        return interaction.reply({
            ...buildWipPayload({
                lang,
                title: 'Profile',
            }),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
