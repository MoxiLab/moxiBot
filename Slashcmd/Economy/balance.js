const { ChatInputCommandBuilder: SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildBalanceMessage } = require('../../Util/balanceView');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('balance');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription(description)
        .setDescriptionLocalizations(localizations)
        .addUserOptions((opt) =>
            opt
                .setName('usuario')
                .setDescription('Usuario (opcional)')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const target = interaction.options.getUser('usuario') || interaction.user;
        const payload = await buildBalanceMessage({ guildId, lang, viewerId: interaction.user.id, targetUser: target });

        // Igual que otros paneles: no efímero por defecto
        return interaction.reply({
            ...payload,
            flags: payload.flags & ~MessageFlags.Ephemeral,
        });
    },
};
