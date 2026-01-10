const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_kick')
      .setLabel('Confirmar Expulsión')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('cancel_kick')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary)
  )
];
