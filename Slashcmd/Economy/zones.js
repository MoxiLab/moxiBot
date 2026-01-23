const { ChatInputCommandBuilder: SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildZonesMessageOptions, normalizeKind } = require('../../Util/zonesView');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('zones');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('zones')
        .setDescription(description)
        .setDescriptionLocalizations(localizations)
        .addStringOptions((opt) =>
            opt
                .setName('tipo')
                .setDescription('Tipo de zonas a mostrar')
                .addChoices(
                    { name: 'Pesca', value: 'fish' },
                    { name: 'Minería', value: 'mine' },
                    { name: 'Exploración', value: 'explore' }
                )
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const kind = normalizeKind(interaction.options.getString('tipo') || 'fish');
        const payload = buildZonesMessageOptions({ lang, userId: interaction.user.id, kind, page: 0 });

        return interaction.reply({
            ...payload,
            flags: payload.flags & ~MessageFlags.Ephemeral,
        });
    },
};
