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
const moxi = require('../i18n');

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

function requirementsText(job, noneText = 'Ninguno') {
    const req = Array.isArray(job?.requirements) ? job.requirements : [];
    return req.length ? req.map(r => String(r)).join(', ') : String(noneText);
}

function buildWorkApplyContainer({ lang = 'es-ES', userId, job } = {}) {
    const t = (k, vars = {}) => moxi.translate(`economy/work:${k}`, lang, vars);

    const shiftsRequired = Number.isFinite(Number(job?.shiftsRequired)) ? Math.max(0, Math.trunc(job.shiftsRequired)) : 8;
    const deathRisk = (typeof job?.deathRisk === 'boolean') ? job.deathRisk : false;

    const title = t('APPLY_TITLE', { job: getJobDisplayName(job, lang) });
    const details = [
        `• ${t('SHIFTS_REQUIRED')}: **${shiftsRequired}**`,
        `• ${t('DEATH_RISK')}: **${deathRisk ? t('YES') : t('NO')}**`,
        `• ${t('SALARY')}: **${salaryText(job)}**`,
        `• ${t('REQUIREMENTS')}: **${requirementsText(job, t('NONE'))}**`,
        '',
        `${t('APPLICANT')}: <@${String(userId || '').trim()}>`,
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
                .setLabel(t('APPLY_CONFIRM')),
            new ButtonBuilder()
                .setCustomId(`work_apply:cancel:${String(userId || '').trim()}:${String(job?.id || '').trim()}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(EMOJIS.cross)
                .setLabel(t('CANCEL'))
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
    const t = (k, vars = {}) => moxi.translate(`economy/work:${k}`, lang, vars);

    const text = [
        t('HIRED_TITLE'),
        t('HIRED_TEXT', { emoji: job?.emoji || '🐾', job: jobName }),
        '',
        t('HIRED_FOOTER'),
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
