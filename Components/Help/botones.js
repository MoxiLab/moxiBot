// Controller for link button row (botones.js)
// Si necesitas lógica especial para estos botones, agrégala aquí.
// Si solo exportas el row, puedes importar este archivo donde lo necesites.

const { ActionRowBuilder, LinkButtonBuilder } = require("discord.js");
const { EMOJIS, toEmojiObject } = require("../../Util/emojis");

const row1 = new ActionRowBuilder()
  .addComponents(
    new LinkButtonBuilder()
      .setLabel("top.gg")
      .setEmoji(toEmojiObject(EMOJIS.smileGrinBig))
      .setURL("https://top.gg/bot/947571048214319134/vote"),
    new LinkButtonBuilder()
      .setLabel("discordbotlist")
      .setEmoji(toEmojiObject(EMOJIS.smileSmile))
      .setURL("https://discordbotlist.com/bots/v8bot/upvote"),
    new LinkButtonBuilder()
      .setLabel("dbotlist")
      .setEmoji(toEmojiObject(EMOJIS.smileGrin))
      .setURL("https://dbots.fun/bot/947571048214319134")
  );

module.exports = { row1 };
