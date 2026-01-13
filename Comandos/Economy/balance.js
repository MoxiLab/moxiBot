const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { ensureMongoConnection } = require('../../Util/mongoConnect');
const { getOrCreateEconomy } = require('../../Util/economyCore');

module.exports = {
  name: 'balance',
  alias: ['bal', 'coins', 'money', 'saldo'],
  Category: function (lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
  },
  usage: 'balance',
  get description() {
    return 'Muestra tu saldo de coins';
  },

  async execute(Moxi, message) {
    if (!process.env.MONGODB) {
      return message.reply(
        asV2MessageOptions(
          buildNoticeContainer({
            emoji: EMOJIS.cross,
            title: 'Economía',
            text: 'MongoDB no está configurado (MONGODB vacío).',
          })
        )
      );
    }

    await ensureMongoConnection();
    const userId = message.author.id;
    const eco = await getOrCreateEconomy(userId);

    const balance = Number.isFinite(eco.balance) ? eco.balance : 0;

    return message.reply(
      asV2MessageOptions(
        buildNoticeContainer({
          emoji: '🪙',
          title: 'Saldo',
          text: `Tienes **${balance}** 🪙.`,
        })
      )
    );
  },
};
