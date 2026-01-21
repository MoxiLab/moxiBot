const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');

const { economyCategory } = require('../../Util/commandCategories');

function hash01(input) {
    const s = String(input || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
}

function yyyyMmDd(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

module.exports = {
    name: 'markettrends',
    alias: ['markettrends', 'trends', 'tendencias'],
    Category: economyCategory,
    usage: 'markettrends',
    description: 'commands:CMD_MARKETTRENDS_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/markettrends:${k}`, lang, vars);

        const topics = [
            { key: 'BUFFS', emoji: '✨' },
            { key: 'TOOLS', emoji: '🛠️' },
            { key: 'PETS', emoji: '🐾' },
            { key: 'MATERIALS', emoji: '🪵' },
            { key: 'LOOT', emoji: '🎁' },
            { key: 'KEYS', emoji: '🗝️' },
            { key: 'COLLECTIBLES', emoji: '🏺' },
            { key: 'POTIONS', emoji: '🧪' },
            { key: 'SCROLLS', emoji: '📜' },
        ];

        // Selección determinista diaria por servidor
        const seedBase = `${yyyyMmDd()}|${guildId || 'dm'}`;
        const scored = topics
            .map((it, idx) => ({
                ...it,
                score: hash01(`${seedBase}|${idx}`),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        const lines = scored.map((it, i) => t('LINE', {
            rank: i + 1,
            icon: it.emoji,
            topic: t(`TOPIC_${it.key}`),
            trend: t(it.score > 0.66 ? 'UP' : (it.score < 0.40 ? 'DOWN' : 'FLAT')),
        }));

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '📊',
                    title: t('TITLE'),
                    text: `${lines.join('\n')}\n\n${t('FOOTER')}`,
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
