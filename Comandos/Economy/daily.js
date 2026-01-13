const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

module.exports = {
  name: 'daily',
  alias: ['diario'],
  Category: function (lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
  },
  usage: 'daily',
  get description() {
    return 'Reclama tu recompensa diaria';
  },

  async execute(Moxi, message) {
    const userId = message.author.id;

    const res = await claimCooldownReward({
      userId,
      field: 'lastDaily',
      cooldownMs: COOLDOWN_MS,
      minAmount: 200,
      maxAmount: 500,
    });

    if (!res.ok) {
      if (res.reason === 'no-db') {
        return message.reply(
          asV2MessageOptions(
            buildNoticeContainer({
              emoji: EMOJIS.cross,
              title: 'Daily',
              text: res.message,
            })
          )
        );
      }

      return message.reply(
        asV2MessageOptions(
          buildNoticeContainer({
            emoji: EMOJIS.info,
            title: 'Daily',
            text: `Ya reclamaste tu daily. Vuelve en **${formatDuration(res.nextInMs)}**.\nSaldo: **${res.balance || 0}** 🪙`,
          })
        )
      );
    }

    return message.reply(
      asV2MessageOptions(
        buildNoticeContainer({
          emoji: EMOJIS.check,
          title: 'Daily',
          text: `Has reclamado **${res.amount}** 🪙.\nSaldo: **${res.balance}** 🪙`,
        })
      )
    );
  },
};
