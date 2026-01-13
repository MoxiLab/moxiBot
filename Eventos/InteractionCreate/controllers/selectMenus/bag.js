const { MessageFlags } = require('discord.js');
const { buildBagMessage } = require('../../../../Util/bagView');

module.exports = async function bagSelectMenu(interaction, Moxi, logger) {
  if (!interaction.isStringSelectMenu()) return false;
  const id = String(interaction.customId || '');
  if (!id.startsWith('bag:sel:')) return false;

  // bag:sel:<viewerId>:<page>
  const parts = id.split(':');
  const viewerId = parts[2];
  const page = Number(parts[3] || 0);

  if (interaction.user?.id !== viewerId) {
    await interaction.reply({ content: 'Solo quien abrió la mochila puede usar este menú.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const selectedCategoryKey = Array.isArray(interaction.values) ? interaction.values[0] : null;
  const payload = await buildBagMessage({
    userId: viewerId,
    viewerId,
    page,
    selectedCategoryKey,
    isPrivate: Boolean(interaction.message?.flags?.has?.(64)),
  });

  await interaction.update(payload);
  return true;
};
