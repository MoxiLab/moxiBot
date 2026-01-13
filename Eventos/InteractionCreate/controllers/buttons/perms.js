const { buildPermsBrowserMessage } = require('../../../../Util/permsView');

module.exports = async function permsButtons(interaction, Moxi, logger) {
  if (!interaction.isButton()) return false;
  const id = String(interaction.customId || '');
  if (!id.startsWith('perms:nav:')) return false;

  // customId: perms:nav:<userId>:<page>:prev|next|close
  const parts = id.split(':');
  const userId = parts[2];
  const page = Number(parts[3] || 0);
  const action = parts[4] || '';

  if (interaction.user?.id !== userId) {
    await interaction.reply({ content: 'Solo quien abrió este panel puede usarlo.', ephemeral: true });
    return true;
  }

  if (action === 'close') {
    await interaction.message.delete().catch(() => {});
    return true;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'No se pudo obtener el servidor.', ephemeral: true });
    return true;
  }

  const nextPage = action === 'prev' ? Math.max(0, page - 1) : page + 1;
  const payload = buildPermsBrowserMessage({ guild, userId, page: nextPage });
  await interaction.update(payload);
  return true;
};
