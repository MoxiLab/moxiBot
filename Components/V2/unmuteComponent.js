const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_unmute')
      .setLabel('Confirmar Quitar Silencio')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('cancel_unmute')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary)
  )
];
