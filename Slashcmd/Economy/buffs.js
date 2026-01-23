const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildBuffsMessage } = require('../../Util/buffsView');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('buffs');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('buffs')
        .setDescription(description)
        .setDescriptionLocalizations(localizations),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const payload = await buildBuffsMessage({ guildId, lang, userId: interaction.user.id });
        const baseFlags = Number(payload?.flags) || 0;

        return interaction.reply({
            ...payload,
            flags: baseFlags | MessageFlags.Ephemeral,
        });
    },
};
