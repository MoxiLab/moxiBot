const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'event',
    alias: ['event'],
    Category: economyCategory,
    usage: 'event | event claim',
    description: 'commands:CMD_EVENT_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');
        const t = (k, vars = {}) => moxi.translate(`economy/event:${k}`, lang, vars);

        const sub = String(args?.[0] || '').trim().toLowerCase();
        const wantsClaim = !sub || ['claim', 'reclamar', 'cobrar'].includes(sub);
        if (!wantsClaim) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.info, title: t('TITLE'), text: t('USAGE', { prefix }) })),
                allowedMentions: { repliedUser: false },
            });
        }

        const cooldownMs = 12 * 60 * 60 * 1000;
        const minAmount = Number.isFinite(Number(process.env.EVENT_MIN)) ? Math.max(0, Math.trunc(Number(process.env.EVENT_MIN))) : 80;
        const maxAmount = Number.isFinite(Number(process.env.EVENT_MAX)) ? Math.max(minAmount, Math.trunc(Number(process.env.EVENT_MAX))) : 220;

        const res = await claimCooldownReward({
            userId: message.author.id,
            field: 'lastEvent',
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
                const show = shouldShowCooldownNotice({ userId: message.author.id, key: 'event', windowMs: 15_000, threshold: 3 });
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
            ...asV2MessageOptions(buildNoticeContainer({ emoji: '🎉', title: t('CLAIMED_TITLE'), text: t('CLAIMED_TEXT', { amount: res.amount, balance: res.balance }) })),
            allowedMentions: { repliedUser: false },
        });
    },
};
