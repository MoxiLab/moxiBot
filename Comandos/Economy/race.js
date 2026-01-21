const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'race',
    alias: ['race'],
    Category: economyCategory,
    usage: 'race',
    description: 'commands:CMD_RACE_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/race:${k}`, lang, vars);

        const cooldownMs = 20 * 60 * 1000; // 20 min
        const minAmount = Number.isFinite(Number(process.env.RACE_MIN)) ? Math.max(0, Math.trunc(Number(process.env.RACE_MIN))) : 60;
        const maxAmount = Number.isFinite(Number(process.env.RACE_MAX)) ? Math.max(minAmount, Math.trunc(Number(process.env.RACE_MAX))) : 180;

        const res = await claimCooldownReward({
            userId: message.author.id,
            field: 'lastRace',
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
                const show = shouldShowCooldownNotice({ userId: message.author.id, key: 'race', windowMs: 15_000, threshold: 3 });
                if (!show) {
                    try { await message.react(EMOJIS.hourglass || '⏳'); } catch { }
                    return;
                }
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.hourglass,
                            title: t('COOLDOWN_TITLE'),
                            text: t('COOLDOWN_TEXT', { next: formatDuration(res.nextInMs) }),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('TITLE'), text: t('ERROR') })),
                allowedMentions: { repliedUser: false },
            });
        }

        const racersRaw = moxi.translate('economy/race:RACERS', lang);
        const racers = Array.isArray(racersRaw) ? racersRaw.filter(Boolean).map(String) : ['Moxi', 'Neko', 'Kitsune', 'Tanuki'];
        const a = racers[Math.floor(Math.random() * racers.length)];
        const b = racers[Math.floor(Math.random() * racers.length)];
        const c = racers[Math.floor(Math.random() * racers.length)];
        const participants = [a, b, c].map(x => String(x || 'Racer')).slice(0, 3);
        const winner = participants[Math.floor(Math.random() * participants.length)];

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🏁',
                    title: t('WIN_TITLE'),
                    text: t('WIN_TEXT', { racers: participants.join(' • '), winner, amount: res.amount, balance: res.balance }),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
