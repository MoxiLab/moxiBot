const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');

const COOLDOWN_MS = 60 * 60 * 1000; // 1h

module.exports = {
  cooldown: 0,
  Category: function (lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
  },
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Trabaja para ganar coins'),

  async run(Moxi, interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const res = await claimCooldownReward({
      userId,
      field: 'lastWork',
      cooldownMs: COOLDOWN_MS,
      minAmount: 50,
      maxAmount: 200,
    });

    if (!res.ok) {
      if (res.reason === 'no-db') {
        return interaction.editReply(
          asV2MessageOptions(
            buildNoticeContainer({
              emoji: EMOJIS.cross,
              title: 'Work',
              text: res.message,
            })
          )
        );
      }

      return interaction.editReply({
        ...asV2MessageOptions(
          buildNoticeContainer({
            emoji: EMOJIS.info,
            title: 'Work',
            text: `Ya trabajaste hace poco. Vuelve en **${formatDuration(res.nextInMs)}**.\nSaldo: **${res.balance || 0}** 🪙`,
          })
        ),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    return interaction.editReply({
      ...asV2MessageOptions(
        buildNoticeContainer({
          emoji: EMOJIS.check,
          title: 'Work',
          text: `Has ganado **${res.amount}** 🪙 trabajando.\nSaldo: **${res.balance}** 🪙`,
        })
      ),
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
