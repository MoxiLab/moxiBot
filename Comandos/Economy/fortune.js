const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'fortune',
    alias: ['fortune'],
    Category: economyCategory,
    usage: 'fortune',
    description: 'commands:CMD_FORTUNE_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/fortune:${k}`, lang, vars);

        const raw = moxi.translate('economy/fortune:LINES', lang);
        const lines = Array.isArray(raw)
            ? raw.filter(Boolean).map(String)
            : String(raw || '').split('\n').map(s => s.trim()).filter(Boolean);

        const fallback = [
            'Hoy te irá mejor de lo que crees.',
            'Una oportunidad pequeña te trae algo grande.',
            'Tu paciencia paga intereses.',
        ];

        const pool = lines.length ? lines : fallback;
        const pick = pool[Math.floor(Math.random() * pool.length)];

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🔮',
                    title: t('TITLE'),
                    text: pick,
                    footerText: t('FOOTER'),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
