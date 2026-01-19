const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildBagMessage } = require('../../Util/bagView');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('bag');

module.exports = {
  cooldown: 0,
  Category: function (lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
  },
  data: new SlashCommandBuilder()
    .setName('bag')
    .setDescription(description)
    .setDescriptionLocalizations(localizations)
    .addIntegerOption((opt) =>
      opt
        .setName('pagina')
        .setDescription('Página (opcional)')
        .setRequired(false)
        .setMinValue(1)
    ),

  async run(Moxi, interaction) {
    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
    const rawPage = interaction.options.getInteger('pagina');
    const page = rawPage ? Math.max(0, rawPage - 1) : 0;

    const payload = await buildBagMessage({
      userId: interaction.user.id,
      viewerId: interaction.user.id,
      page,
      isPrivate: true,
      lang,
    });

    const baseFlags = Number(payload?.flags) || 0;
    return interaction.reply({
      ...payload,
      flags: baseFlags | MessageFlags.Ephemeral,
    });
  },
};
