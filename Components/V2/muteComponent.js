const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_mute')
      .setLabel('Confirmar Silencio')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('cancel_mute')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary)
  )
];
