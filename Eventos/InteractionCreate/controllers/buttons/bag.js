const { MessageFlags } = require('discord.js');
const moxi = require('../../../../i18n');
const { buildBagMessage } = require('../../../../Util/bagView');

module.exports = async function bagButtons(interaction, Moxi, logger) {
  if (!interaction.isButton()) return false;
  const id = String(interaction.customId || '');
  if (!id.startsWith('bag:nav:')) return false;

  const guildId = interaction.guildId || interaction.guild?.id;
  const fallbackLang = interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES';
  const lang = Moxi?.guildLang ? await Moxi.guildLang(guildId, fallbackLang) : fallbackLang;
  const t = (k, vars) => moxi.translate(`economy/bag:${k}`, lang, vars);

  // Formatos soportados:
  // - Antiguo: bag:nav:<viewerId>:<page>:action
  // - Nuevo:   bag:nav:<viewerId>:<categoryKey>:<page>:action
  const parts = id.split(':');
  const viewerId = parts[2];
  const hasCategory = parts.length >= 6;
  const categoryKey = hasCategory ? parts[3] : null;
  const page = Number((hasCategory ? parts[4] : parts[3]) || 0);
  const action = (hasCategory ? parts[5] : parts[4]) || '';

  if (interaction.user?.id !== viewerId) {
    await interaction.reply({ content: t('ONLY_AUTHOR_BUTTONS'), flags: MessageFlags.Ephemeral });
    return true;
  }

  if (action === 'info') {
    await interaction.reply({
      content: t('INFO_TEXT'),
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (action === 'close') {
    try {
      if (interaction.message?.deletable) {
        await interaction.message.delete();
      } else {
        await interaction.update({ content: t('CLOSED_TEXT'), embeds: [], components: [] });
      }
    } catch {
      try {
        await interaction.update({ content: t('CLOSED_TEXT'), embeds: [], components: [] });
      } catch { }
    }
    return true;
  }

  const nextPage =
    action === 'prev'
      ? Math.max(0, page - 1)
      : action === 'home'
        ? 0
        : page + 1;

  const payload = await buildBagMessage({
    userId: viewerId,
    viewerId,
    page: nextPage,
    selectedCategoryKey: categoryKey && categoryKey !== 'none' ? categoryKey : null,
    isPrivate: Boolean(interaction.message?.flags?.has?.(64)),
    lang,
  });

  await interaction.update(payload);
  return true;
};
