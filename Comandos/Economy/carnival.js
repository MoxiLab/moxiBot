const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');
const { economyCategory } = require('../../Util/commandCategories');
module.exports = {
    name: 'carnival',
    alias: ['carnival'],
    Category: economyCategory,
    usage: 'carnival',
    description: 'commands:CMD_CARNIVAL_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/carnival:${k}`, lang, vars);

        // Temporada de “carnival”: Feb 1 -> Mar 15 (UTC)
        const now = new Date();
        const month = now.getUTCMonth() + 1;
        const day = now.getUTCDate();
        const inSeason = (month === 2) || (month === 3 && day <= 15);

        if (!inSeason) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: '🎭', title: t('TITLE'), text: t('OUT_OF_SEASON') })),
                allowedMentions: { repliedUser: false },
            });
        }

        const cooldownMs = 24 * 60 * 60 * 1000;
        const minAmount = Number.isFinite(Number(process.env.CARNIVAL_MIN)) ? Math.max(0, Math.trunc(Number(process.env.CARNIVAL_MIN))) : 150;
        const maxAmount = Number.isFinite(Number(process.env.CARNIVAL_MAX)) ? Math.max(minAmount, Math.trunc(Number(process.env.CARNIVAL_MAX))) : 450;

        const res = await claimCooldownReward({
            userId: message.author.id,
            field: 'lastCarnival',
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
                const show = shouldShowCooldownNotice({ userId: message.author.id, key: 'carnival', windowMs: 15_000, threshold: 3 });
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
            ...asV2MessageOptions(buildNoticeContainer({ emoji: '🎭', title: t('CLAIMED_TITLE'), text: t('CLAIMED_TEXT', { amount: res.amount, balance: res.balance }) })),
            allowedMentions: { repliedUser: false },
        });
    },
};
