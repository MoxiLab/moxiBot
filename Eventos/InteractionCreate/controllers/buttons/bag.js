const { MessageFlags } = require('discord.js');
const { buildBagMessage } = require('../../../../Util/bagView');

module.exports = async function bagButtons(interaction, Moxi, logger) {
  if (!interaction.isButton()) return false;
  const id = String(interaction.customId || '');
  if (!id.startsWith('bag:nav:')) return false;

  // bag:nav:<viewerId>:<page>:action
  const parts = id.split(':');
  const viewerId = parts[2];
  const page = Number(parts[3] || 0);
  const action = parts[4] || '';

  if (interaction.user?.id !== viewerId) {
    await interaction.reply({ content: 'Solo quien abrió la mochila puede usar estos botones.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (action === 'info') {
    await interaction.reply({
      content: 'Usa el selector para ver detalles. Navega con ◀ ▶. Cierra con ❌.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (action === 'close') {
    try {
      if (interaction.message?.deletable) {
        await interaction.message.delete();
      } else {
        await interaction.update({ content: 'Mochila cerrada.', embeds: [], components: [] });
      }
    } catch {
      try {
        await interaction.update({ content: 'Mochila cerrada.', embeds: [], components: [] });
      } catch {}
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
    isPrivate: Boolean(interaction.message?.flags?.has?.(64)),
  });

  await interaction.update(payload);
  return true;
};
