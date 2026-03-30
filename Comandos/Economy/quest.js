const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');

const { economyCategory } = require('../../Util/commandCategories');

function dayKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function hashInt(s) {
    const str = String(s || '');
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

module.exports = {
    name: 'quest',
    alias: ['quest'],
    Category: economyCategory,
    usage: 'quest | quest claim',
    description: 'commands:CMD_QUEST_DESC',
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
        const t = (k, vars = {}) => moxi.translate(`economy/quest:${k}`, lang, vars);

        const sub = String(args?.[0] || '').trim().toLowerCase();
        const wantsClaim = ['claim', 'reclamar', 'cobrar'].includes(sub);

        // Lista diaria determinista (no depende de DB)
        const poolRaw = moxi.translate('economy/quest:QUESTS', lang);
        const pool = Array.isArray(poolRaw) ? poolRaw.filter(Boolean).map(String) : [];
        const fallback = [
            'Gana 1 partida de ruleta',
            'Compra 1 objeto en la tienda',
            'Vende 1 objeto del inventario',
            'Reclama tu daily',
            'Trabaja una vez',
        ];
        const quests = (pool.length ? pool : fallback);

        const seed = hashInt(`${dayKey()}:${guildId}:${message.author.id}`);
        const picks = [];
        for (let i = 0; i < Math.min(3, quests.length); i += 1) {
            const idx = (seed + i * 97) % quests.length;
            picks.push(quests[idx]);
        }

        if (!wantsClaim) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '📜',
                        title: t('TITLE'),
                        text: t('LIST_TEXT', { list: picks.map((q) => `• ${q}`).join('\n'), prefix }),
                        footerText: t('FOOTER', { prefix }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const cooldownMs = 24 * 60 * 60 * 1000;
        const minAmount = Number.isFinite(Number(process.env.QUEST_MIN)) ? Math.max(0, Math.trunc(Number(process.env.QUEST_MIN))) : 250;
        const maxAmount = Number.isFinite(Number(process.env.QUEST_MAX)) ? Math.max(minAmount, Math.trunc(Number(process.env.QUEST_MAX))) : 600;

        const res = await claimCooldownReward({
            userId: message.author.id,
            field: 'lastQuest',
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
                const show = shouldShowCooldownNotice({ userId: message.author.id, key: 'quest', windowMs: 15_000, threshold: 3 });
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
            ...asV2MessageOptions(buildNoticeContainer({ emoji: '✅', title: t('CLAIMED_TITLE'), text: t('CLAIMED_TEXT', { amount: res.amount, balance: res.balance }) })),
            allowedMentions: { repliedUser: false },
        });
    },
};
