const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');

const { economyCategory } = require('../../Util/commandCategories');
module.exports = {
    name: 'collect',
    alias: ['collect'],
    Category: economyCategory,
    usage: 'collect',
    description: 'commands:CMD_COLLECT_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/collect:${k}`, lang, vars);

        const cooldownMs = 10 * 60 * 1000; // 10 min
        const minAmount = Number.isFinite(Number(process.env.COLLECT_MIN)) ? Math.max(0, Math.trunc(Number(process.env.COLLECT_MIN))) : 20;
        const maxAmount = Number.isFinite(Number(process.env.COLLECT_MAX)) ? Math.max(minAmount, Math.trunc(Number(process.env.COLLECT_MAX))) : 80;

        const res = await claimCooldownReward({
            userId: message.author.id,
            field: 'lastCollect',
            cooldownMs,
            minAmount,
            maxAmount,
        });

        if (!res.ok) {
            if (res.reason === 'no-db') {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('TITLE'),
                            text: t('NO_DB'),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            if (res.reason === 'cooldown') {
                const show = shouldShowCooldownNotice({ userId: message.author.id, key: 'collect', windowMs: 15_000, threshold: 3 });
                if (!show) {
                    try { await message.react(EMOJIS.hourglass || '⏳'); } catch { }
                    return;
                }

                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.hourglass,
                            title: t('COOLDOWN_TITLE'),
                            text: t('COOLDOWN_TEXT', { next: formatDuration(res.nextInMs), balance: res.balance }),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('TITLE'),
                        text: t('ERROR'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🧺',
                    title: t('CLAIMED_TITLE'),
                    text: t('CLAIMED_TEXT', { amount: res.amount, balance: res.balance }),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
