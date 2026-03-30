// Controller for link button row (botones.js)
// Si necesitas lógica especial para estos botones, agrégala aquí.
// Si solo exportas el row, puedes importar este archivo donde lo necesites.

const { ActionRowBuilder, ButtonStyle } = require("discord.js");
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const { EMOJIS } = require("../../Util/emojis");

const row1 = new ActionRowBuilder()
  .addComponents(
    new ButtonBuilder()
      .setLabel("top.gg")
      .setStyle(ButtonStyle.Link)
      .setEmoji(EMOJIS.smileGrinBig)
      .setURL("https://top.gg/bot/947571048214319134/vote"),
    new ButtonBuilder()
      .setLabel("discordbotlist")
      .setStyle(ButtonStyle.Link)
      .setEmoji(EMOJIS.smileSmile)
      .setURL("https://discordbotlist.com/bots/v8bot/upvote"),
    new ButtonBuilder()
      .setLabel("dbotlist")
      .setStyle(ButtonStyle.Link)
      .setEmoji(EMOJIS.smileGrin)
      .setURL("https://dbots.fun/bot/947571048214319134")
  );

module.exports = { row1 };
