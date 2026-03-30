const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'xmas',
    alias: ['xmas'],
    Category: economyCategory,
    usage: 'xmas',
    description: 'commands:CMD_XMAS_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/xmas:${k}`, lang, vars);

        // Temporada: Dec 1 -> Jan 7 (UTC)
        const now = new Date();
        const month = now.getUTCMonth() + 1;
        const day = now.getUTCDate();
        const inSeason = (month === 12) || (month === 1 && day <= 7);

        if (!inSeason) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: '🎄', title: t('TITLE'), text: t('OUT_OF_SEASON') })),
                allowedMentions: { repliedUser: false },
            });
        }

        const cooldownMs = 24 * 60 * 60 * 1000;
        const minAmount = Number.isFinite(Number(process.env.XMAS_MIN)) ? Math.max(0, Math.trunc(Number(process.env.XMAS_MIN))) : 200;
        const maxAmount = Number.isFinite(Number(process.env.XMAS_MAX)) ? Math.max(minAmount, Math.trunc(Number(process.env.XMAS_MAX))) : 600;

        const res = await claimCooldownReward({
            userId: message.author.id,
            field: 'lastXmas',
            cooldownMs,
            minAmount,
            maxAmount,
        });

        if (!res.ok) {
            if (res.reason === 'no-db') {
                return message.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('TITLE'), text: t('NO_DB') })),
                    allowedMentions: { repliedUser: false },
                });
            }
            if (res.reason === 'cooldown') {
                const show = shouldShowCooldownNotice({ userId: message.author.id, key: 'xmas', windowMs: 15_000, threshold: 3 });
                if (!show) {
                    try { await message.react(EMOJIS.hourglass || '⏳'); } catch { }
                    return;
                }
                return message.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.hourglass, title: t('COOLDOWN_TITLE'), text: t('COOLDOWN_TEXT', { next: formatDuration(res.nextInMs) }) })),
                    allowedMentions: { repliedUser: false },
                });
            }
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('TITLE'), text: t('ERROR') })),
                allowedMentions: { repliedUser: false },
            });
        }

        return message.reply({
            ...asV2MessageOptions(buildNoticeContainer({ emoji: '🎄', title: t('CLAIMED_TITLE'), text: t('CLAIMED_TEXT', { amount: res.amount, balance: res.balance }) })),
            allowedMentions: { repliedUser: false },
        });
    },
};
