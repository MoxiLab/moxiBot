const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_unban')
      .setLabel('Confirmar Desbaneo')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('cancel_unban')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary)
  )
];
