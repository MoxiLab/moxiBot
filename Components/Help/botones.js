// Controller for link button row (botones.js)
// Si necesitas lógica especial para estos botones, agrégala aquí.
// Si solo exportas el row, puedes importar este archivo donde lo necesites.

const { ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { EMOJIS } = require("../../Util/emojis");

const row1 = new ActionRowBuilder()
  .addComponents(
    new ButtonBuilder()
      .setLabel("top.gg")
      .setStyle("Link")
      .setEmoji(EMOJIS.smileGrinBig)
      .setURL("https://top.gg/bot/947571048214319134/vote"),
    new ButtonBuilder()
      .setLabel("discordbotlist")
      .setStyle("Link")
      .setEmoji(EMOJIS.smileSmile)
      .setURL("https://discordbotlist.com/bots/v8bot/upvote"),
    new ButtonBuilder()
      .setLabel("dbotlist")
      .setStyle("Link")
      .setEmoji(EMOJIS.smileGrin)
      .setURL("https://dbots.fun/bot/947571048214319134")
  );

module.exports = { row1 };
