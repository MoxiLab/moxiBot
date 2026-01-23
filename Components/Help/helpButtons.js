// Botones de navegación y ayuda para el menú de /help
const { ActionRowBuilder, PrimaryButtonBuilder, SecondaryButtonBuilder, DangerButtonBuilder } = require("discord.js");
const { EMOJIS, toEmojiObject } = require("../../Util/emojis");

const help = new ActionRowBuilder().addComponents(
  new PrimaryButtonBuilder()
    .setCustomId("help_prev")
    .setEmoji(toEmojiObject(EMOJIS.arrowLeft)),
  new SecondaryButtonBuilder()
    .setCustomId("help_home")
    .setEmoji(toEmojiObject(EMOJIS.home)),
  new SecondaryButtonBuilder()
    .setCustomId("help_info")
    .setEmoji(toEmojiObject(EMOJIS.info)),
  new DangerButtonBuilder()
    .setCustomId("help_close")
    .setEmoji(toEmojiObject(EMOJIS.cross)),
  new PrimaryButtonBuilder()
    .setCustomId("help_next")
    .setEmoji(toEmojiObject(EMOJIS.arrowRight))
);

module.exports = { help };
