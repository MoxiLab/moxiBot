const {
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ThumbnailBuilder,
} = require('discord.js');

const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { getJobDisplayName } = require('./workSystem');

const COIN = EMOJIS.coin || '\u{1FA99}'; // 🪙

function safeInt(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.trunc(x);
}

function getJobImageUrl(job) {
    if (job && typeof job.imageUrl === 'string' && /^https?:\/\//.test(job.imageUrl)) return job.imageUrl;
    const text = encodeURIComponent(String(job?.emoji || '💼'));
    return `https://dummyimage.com/160x160/1f1f1f/ffffff.png&text=${text}`;
}

function salaryText(job) {
    const fixed = Number.isFinite(Number(job?.salary)) ? Math.max(0, Math.trunc(job.salary)) : null;
    if (fixed !== null) return `${fixed} ${COIN}`;
    const min = safeInt(job?.min, 0);
    const max = safeInt(job?.max, min);
    return `**${min}–${max}** ${COIN}`;
}

function requirementsText(job) {
    const req = Array.isArray(job?.requirements) ? job.requirements : [];
    return req.length ? req.map(r => String(r)).join(', ') : 'Ninguno';
}

function buildWorkApplyContainer({ lang = 'es-ES', userId, job } = {}) {
    const shiftsRequired = Number.isFinite(Number(job?.shiftsRequired)) ? Math.max(0, Math.trunc(job.shiftsRequired)) : 0;
    const deathRisk = (typeof job?.deathRisk === 'boolean') ? job.deathRisk : false;

    const title = `🪪 Postulación a ${getJobDisplayName(job, lang)}`;
    const details = [
        `• Trabajos requeridos por día: **${shiftsRequired}**`,
        `• Riesgo de muerte: **${deathRisk ? 'Sí' : 'No'}**`,
        `• Salario: **${salaryText(job)}**`,
        `• Requerimientos: **${requirementsText(job)}**`,
        '',
        `Solicitante: <@${String(userId || '').trim()}>`,
    ].join('\n');

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addSectionComponents(section =>
            section
                .addTextDisplayComponents(t => t.setContent(`${title}\n${details}`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(getJobImageUrl(job)))
        );

    container.addActionRowComponents(row =>
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`work_apply:confirm:${String(userId || '').trim()}:${String(job?.id || '').trim()}`)
                .setStyle(ButtonStyle.Success)
                .setLabel('📝 Postular al trabajo'),
            new ButtonBuilder()
                .setCustomId(`work_apply:cancel:${String(userId || '').trim()}:${String(job?.id || '').trim()}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(EMOJIS.cross)
                .setLabel('Cancelar')
        )
    );

    return container;
}

function buildWorkApplyMessageOptions({ lang = 'es-ES', userId, job } = {}) {
    const container = buildWorkApplyContainer({ lang, userId, job });
    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function buildWorkHiredContainer({ lang = 'es-ES', userId, job } = {}) {
    const jobName = getJobDisplayName(job, lang);

    const text = [
        '## ¡Contratado/a!',
        `${job?.emoji || '🐾'} ¡Felicidades! Has sido aceptado/a como **${jobName}**.`,
        '',
        'Ahora puedes comenzar a trabajar con el comando `work`.',
    ].join('\n');

    return new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addSectionComponents(section =>
            section
                .addTextDisplayComponents(t => t.setContent(text))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(getJobImageUrl(job)))
        );
}

function buildWorkHiredMessageOptions({ lang = 'es-ES', userId, job } = {}) {
    const container = buildWorkHiredContainer({ lang, userId, job });
    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function parseWorkApplyCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('work_apply:')) return null;
    const parts = raw.split(':');
    // work_apply:action:userId:jobId
    const action = parts[1] || null;
    const userId = parts[2] || null;
    const jobId = parts[3] || null;
    if (!action || !userId || !jobId) return null;
    return { action, userId, jobId };
}

module.exports = {
    buildWorkApplyContainer,
    buildWorkApplyMessageOptions,
    buildWorkHiredContainer,
    buildWorkHiredMessageOptions,
    parseWorkApplyCustomId,
    salaryText,
    requirementsText,
};
