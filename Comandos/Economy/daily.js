const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'daily',
    alias: ['daily'],
    Category: economyCategory,
    usage: 'daily',
    description: 'commands:CMD_DAILY_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/daily:${k}`, lang, vars);

        const cooldownMs = 24 * 60 * 60 * 1000;
        const minAmount = Number.isFinite(Number(process.env.DAILY_MIN)) ? Math.max(0, Math.trunc(Number(process.env.DAILY_MIN))) : 200;
        const maxAmount = Number.isFinite(Number(process.env.DAILY_MAX)) ? Math.max(minAmount, Math.trunc(Number(process.env.DAILY_MAX))) : 400;

        const res = await claimCooldownReward({
            userId: message.author.id,
            field: 'lastDaily',
            cooldownMs,
            minAmount,
            maxAmount,
        });

        if (!res.ok) {
            if (res.reason === 'no-db') {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('NO_DB_TITLE'),
                            text: t('NO_DB_TEXT'),
                        })
                    )
                );
            }

            if (res.reason === 'cooldown') {
                const show = shouldShowCooldownNotice({ userId: message.author.id, key: 'daily', windowMs: 15_000, threshold: 3 });
                if (!show) {
                    try { await message.react(EMOJIS.hourglass || '⏳'); } catch { }
                    return;
                }

                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.hourglass,
                            title: t('COOLDOWN_TITLE'),
                            text: t('COOLDOWN_TEXT', {
                                next: formatDuration(res.nextInMs),
                                balance: res.balance,
                            }),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: res.message || t('UNKNOWN_ERROR'),
                    })
                )
            );
        }

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🎁',
                    title: t('CLAIMED_TITLE'),
                    text: t('CLAIMED_TEXT', { amount: res.amount, balance: res.balance }),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
