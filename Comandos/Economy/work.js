const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');

const COOLDOWN_MS = 60 * 60 * 1000; // 1h

module.exports = {
  name: 'work',
  alias: ['trabajar', 'curro'],
  Category: function (lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
  },
  usage: 'work',
  get description() {
    return 'Trabaja para ganar coins';
  },

  async execute(Moxi, message) {
    const userId = message.author.id;

    const res = await claimCooldownReward({
      userId,
      field: 'lastWork',
      cooldownMs: COOLDOWN_MS,
      minAmount: 50,
      maxAmount: 200,
    });

    if (!res.ok) {
      if (res.reason === 'no-db') {
        return message.reply(
          asV2MessageOptions(
            buildNoticeContainer({
              emoji: EMOJIS.cross,
              title: 'Work',
              text: res.message,
            })
          )
        );
      }

      return message.reply(
        asV2MessageOptions(
          buildNoticeContainer({
            emoji: EMOJIS.info,
            title: 'Work',
            text: `Ya trabajaste hace poco. Vuelve en **${formatDuration(res.nextInMs)}**.\nSaldo: **${res.balance || 0}** 🪙`,
          })
        )
      );
    }

    return message.reply(
      asV2MessageOptions(
        buildNoticeContainer({
          emoji: EMOJIS.check,
          title: 'Work',
          text: `Has ganado **${res.amount}** 🪙 trabajando.\nSaldo: **${res.balance}** 🪙`,
        })
      )
    );
  },
};
