const {
    ContainerBuilder,
    ButtonStyle,
    MessageFlags,
    ThumbnailBuilder,
} = require('discord.js');

const { ButtonBuilder } = require('./compatButtonBuilder');

const moxi = require('../i18n');
const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { listJobs, getJobDisplayName } = require('./workSystem');

const COIN = '\u{1FA99}'; // 🪙
const DEFAULT_PER_PAGE = 3;

function clampInt(n, min, max) {
    const x = Number.parseInt(String(n), 10);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
}

function normalizeText(input) {
    return String(input || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function getJobImageUrl(job) {
    if (job && typeof job.imageUrl === 'string' && /^https?:\/\//.test(job.imageUrl)) return job.imageUrl;
    const text = encodeURIComponent(String(job?.emoji || '💼'));
    return `https://dummyimage.com/160x160/1f1f1f/ffffff.png&text=${text}`;
}

function getJobTagline(job, lang) {
    const raw = typeof job?.tagline === 'string' ? job.tagline : '';
    if (raw) return raw;
    // Fallback suave
    const isEs = /^es(-|$)/i.test(String(lang || ''));
    return isEs
        ? 'Únete y empieza a ganar recompensas con cada turno.'
        : 'Join and start earning rewards with every shift.';
}

function getFeaturedJob(jobs) {
    const featured = jobs.find(j => j && j.featured);
    return featured || jobs[0] || null;
}

function buildWorkListButtons({ userId, page, totalPages, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const p = clampInt(page, 0, Math.max(0, (totalPages || 1) - 1));

    const prev = new ButtonBuilder()
        .setCustomId(`work_list:prev:${safeUserId}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.arrowLeft)
        .setDisabled(disabled || p <= 0);

    const refresh = new ButtonBuilder()
        .setCustomId(`work_list:refresh:${safeUserId}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🐾')
        .setDisabled(disabled);

    const close = new ButtonBuilder()
        .setCustomId(`work_list:close:${safeUserId}:${p}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(EMOJIS.cross)
        .setDisabled(disabled);

    const help = new ButtonBuilder()
        .setCustomId(`work_list:help:${safeUserId}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.question)
        .setDisabled(disabled);

    const next = new ButtonBuilder()
        .setCustomId(`work_list:next:${safeUserId}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.arrowRight)
        .setDisabled(disabled || p >= (totalPages - 1));

    return [prev, refresh, close, help, next];
}

function buildWorkListContainer({ lang = 'es-ES', page = 0, userId, perPage = DEFAULT_PER_PAGE, disabledButtons = false } = {}) {
    const tr = (k, vars = {}) => moxi.translate(`economy/work:${k}`, lang, vars);

    const jobs = listJobs();
    const safePerPage = Math.max(1, Math.min(5, Number(perPage) || DEFAULT_PER_PAGE));
    const totalPages = Math.max(1, Math.ceil(jobs.length / safePerPage));
    const p = clampInt(page, 0, totalPages - 1);

    const featured = getFeaturedJob(jobs);

    const start = p * safePerPage;
    const slice = jobs.slice(start, start + safePerPage);

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(td => td.setContent(tr('PAGE', { page: p + 1, total: totalPages })))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(td => td.setContent(tr('LIST_TITLE')));

    if (featured) {
        container
            .addTextDisplayComponents(td =>
                td.setContent(
                    `${EMOJIS.star || '⭐'} ${tr('FEATURED')}: ${featured.emoji || '💼'} **${getJobDisplayName(featured, lang)}**\n` +
                    `_${getJobTagline(featured, lang)}_`
                )
            )
            .addSeparatorComponents(s => s.setDivider(true));
    }

    for (const job of slice) {
        const shiftsRequired = Number.isFinite(Number(job?.shiftsRequired)) ? Math.max(0, Math.trunc(job.shiftsRequired)) : 8;
        const deathRisk = (typeof job?.deathRisk === 'boolean') ? job.deathRisk : false;

        const salary = Number.isFinite(Number(job?.salary))
            ? Math.max(0, Math.trunc(job.salary))
            : null;

        const salaryText = salary !== null
            ? `${salary} ${COIN}`
            : `**${job.min}–${job.max}** ${COIN}`;

        const req = Array.isArray(job?.requirements) ? job.requirements : [];
        const reqText = req.length
            ? req.map(r => String(r)).join(', ')
            : tr('NONE');

        container
            .addSectionComponents(section =>
                section
                    .addTextDisplayComponents(td =>
                        td.setContent(
                            `${job.emoji || '💼'} **${getJobDisplayName(job, lang)}**\n` +
                            `• ${tr('SHIFTS_REQUIRED')}: **${shiftsRequired}**\n` +
                            `• ${tr('DEATH_RISK')}: **${deathRisk ? tr('YES') : tr('NO')}**\n` +
                            `• ${tr('SALARY')}: **${salaryText}**\n` +
                            `• ${tr('REQUIREMENTS')}: **${reqText}**`
                        )
                    )
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(getJobImageUrl(job)))
            )
            .addSeparatorComponents(s => s.setDivider(true));
    }

    container.addTextDisplayComponents(td => td.setContent(tr('APPLY_HINT')));

    container.addActionRowComponents(row => row.addComponents(
        ...buildWorkListButtons({ userId, page: p, totalPages, disabled: disabledButtons })
    ));
    return { container, page: p, totalPages };
}

function buildWorkListMessageOptions({ lang = 'es-ES', page = 0, userId, perPage } = {}) {
    const { container } = buildWorkListContainer({ lang, page, userId, perPage });
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function parseWorkListCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('work_list:')) return null;
    const parts = raw.split(':');
    // work_list:action:userId:page
    const action = parts[1] || null;
    const userId = parts[2] || null;
    const page = parts[3] || null;
    if (!action || !userId) return null;
    return { action, userId, page: page !== null ? Number.parseInt(page, 10) : 0 };
}

function filterJobsForAutocomplete({ lang, query } = {}) {
    const q = normalizeText(query);
    const jobs = listJobs();
    return jobs
        .filter(j => {
            if (!q) return true;
            const id = normalizeText(j.id);
            const base = normalizeText(j.name);
            const disp = normalizeText(getJobDisplayName(j, lang));
            return id.includes(q) || base.includes(q) || disp.includes(q);
        })
        .slice(0, 25)
        .map(j => ({
            label: `${j.emoji || '💼'} ${getJobDisplayName(j, lang)} (${j.id})`,
            value: String(j.id),
        }));
}

module.exports = {
    buildWorkListContainer,
    buildWorkListMessageOptions,
    parseWorkListCustomId,
    buildWorkListButtons,
    filterJobsForAutocomplete,
};
