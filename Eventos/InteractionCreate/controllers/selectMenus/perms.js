const { buildPermsBrowserMessage } = require('../../../../Util/permsView');

module.exports = async function permsSelectMenu(interaction, Moxi, logger) {
  if (!interaction.isStringSelectMenu()) return false;
  const id = String(interaction.customId || '');
  if (!id.startsWith('perms:select:')) return false;

  // customId: perms:select:<userId>:<page>
  const parts = id.split(':');
  const userId = parts[2];
  const page = Number(parts[3] || 0);

  if (interaction.user?.id !== userId) {
    await interaction.reply({ content: 'Solo quien abrió este panel puede usarlo.', ephemeral: true });
    return true;
  }

  const selectedChannelId = Array.isArray(interaction.values) ? interaction.values[0] : null;
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'No se pudo obtener el servidor.', ephemeral: true });
    return true;
  }

  const payload = buildPermsBrowserMessage({ guild, userId, page, selectedChannelId });
  await interaction.update(payload);
  return true;
};
