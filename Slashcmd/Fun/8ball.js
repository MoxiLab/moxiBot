const { SlashCommandBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { funCategory } = require('../../Util/commandCategories');

function pick(arr) {
    const a = Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
    if (!a.length) return null;
    return a[Math.floor(Math.random() * a.length)];
}

module.exports = {
    cooldown: 0,
    Category: funCategory,
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Responde a tu pregunta con una respuesta aleatoria')
        .addStringOption(opt =>
            opt
                .setName('pregunta')
                .setDescription('Tu pregunta')
                .setRequired(true)
        )
        .setDMPermission(true),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const question = String(interaction.options.getString('pregunta') || '').trim();

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

        return interaction.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🎱',
                    title: moxi.translate('FUN_8BALL_TITLE', lang) || '8ball',
                    text: moxi.translate('FUN_8BALL_RESULT', lang, { question, answer }) || `Pregunta: ${question}\nRespuesta: ${answer}`,
                })
            ),
        });
    },
};
