const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_warn')
      .setLabel('Confirmar Advertencia')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('cancel_warn')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary)
  )
];
