const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { funCategory } = require('../../Util/commandCategories');

function pick(arr) {
    const a = Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
    if (!a.length) return null;
    return a[Math.floor(Math.random() * a.length)];
}

module.exports = {
    name: '8ball',
    alias: ['8ball', 'ball', 'bola8'],
    Category: funCategory,
    usage: '8ball <pregunta>',
    description: 'commands:CMD_8BALL_DESC',
    cooldown: 0,

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const question = Array.isArray(args) ? args.join(' ').trim() : '';
        if (!question) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🎱',
                        title: moxi.translate('FUN_8BALL_TITLE', lang) || '8ball',
                        text: moxi.translate('FUN_8BALL_NO_QUESTION', lang) || 'Escribe una pregunta para que pueda responder.',
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const answers = moxi.translate('FUN_8BALL_ANSWERS', lang, { returnObjects: true });
        const fallback = [
            'Sí.',
            'No.',
            'Tal vez.',
            'Pregunta de nuevo más tarde.',
            'No puedo asegurarlo.',
            'Definitivamente.',
        ];

        const answer = pick(answers) || pick(fallback) || '...';

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🎱',
                    title: moxi.translate('FUN_8BALL_TITLE', lang) || '8ball',
                    text: moxi.translate('FUN_8BALL_RESULT', lang, { question, answer }) || `Pregunta: ${question}\nRespuesta: ${answer}`,
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
