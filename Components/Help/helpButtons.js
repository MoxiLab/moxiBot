// Botones de navegación y ayuda para el menú de /help
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { EMOJIS } = require("../../Util/emojis");

const help = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("help_prev")
    .setStyle(ButtonStyle.Primary)
    .setEmoji(EMOJIS.arrowLeft),
  new ButtonBuilder()
    .setCustomId("help_home")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(EMOJIS.home),
  new ButtonBuilder()
    .setCustomId("help_info")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(EMOJIS.info),
  new ButtonBuilder()
    .setCustomId("help_close")
    .setStyle(ButtonStyle.Danger)
    .setEmoji(EMOJIS.cross),
  new ButtonBuilder()
    .setCustomId("help_next")
    .setStyle(ButtonStyle.Primary)
    .setEmoji(EMOJIS.arrowRight)
);

module.exports = { help };
