const { MessageFlags } = require('discord.js');
const moxi = require('../../../../i18n');
const { buildBagMessage } = require('../../../../Util/bagView');

module.exports = async function bagSelectMenu(interaction, Moxi, logger) {
  if (!interaction.isStringSelectMenu()) return false;
  const id = String(interaction.customId || '');
  if (!id.startsWith('bag:sel:')) return false;

  // bag:sel:<viewerId>:<page>
  const parts = id.split(':');
  const viewerId = parts[2];
  const page = Number(parts[3] || 0);

  const guildId = interaction.guildId || interaction.guild?.id;
  const lang = Moxi?.guildLang ? await Moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES') : (process.env.DEFAULT_LANG || 'es-ES');
  const t = (k, vars) => moxi.translate(`economy/bag:${k}`, lang, vars);

  if (interaction.user?.id !== viewerId) {
    await interaction.reply({ content: t('ONLY_AUTHOR_MENU'), flags: MessageFlags.Ephemeral });
    return true;
  }

  const selectedCategoryKey = Array.isArray(interaction.values) ? interaction.values[0] : null;

  const payload = await buildBagMessage({
    userId: viewerId,
    viewerId,
    page: 0,
    selectedCategoryKey: selectedCategoryKey && selectedCategoryKey !== 'none' ? selectedCategoryKey : null,
    isPrivate: Boolean(interaction.message?.flags?.has?.(64)),
    lang,
  });

  await interaction.update(payload);
  return true;
};
