const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_timeout')
      .setLabel('Confirmar Timeout')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('cancel_timeout')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary)
  )
];
