const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');
const {
    listJobs,
    resolveJob,
    getJobDisplayName,
    getWorkCooldownMs,
    applyJob,
    leaveJob,
    doShift,
    getWorkStats,
    getTopByJob,
} = require('../../Util/workSystem');
const { formatDuration } = require('../../Util/economyCore');
const { buildWorkListMessageOptions } = require('../../Util/workListPanel');
const { buildWorkApplyMessageOptions } = require('../../Util/workApplyPanel');
const { slashMention } = require('../../Util/slashCommandMentions');

function economyCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
}

function formatJobsList(lang) {
    const t = (k, vars = {}) => moxi.translate(`economy/work:${k}`, lang, vars);
    const jobs = listJobs();
    const lines = jobs.map(j => t('JOB_LINE', {
        emoji: j.emoji || '💼',
        job: getJobDisplayName(j, lang),
        id: j.id,
        min: j.min,
        max: j.max,
    }));
    return lines.join('\n');
}

async function renderTop({ client, rows, lang }) {
    const t = (k, vars = {}) => moxi.translate(`economy/work:${k}`, lang, vars);
    const resolved = await Promise.allSettled(
        rows.map(async (r) => {
            try {
                const u = await client.users.fetch(r.userId);
                return { label: u.tag, userId: r.userId, totalEarned: r.totalEarned, shifts: r.shifts };
            } catch {
                return { label: r.userId, userId: r.userId, totalEarned: r.totalEarned, shifts: r.shifts };
            }
        })
    );

    const lines = resolved.map((p, idx) => {
        const v = p.status === 'fulfilled' ? p.value : { label: 'Unknown', userId: 'unknown', totalEarned: 0, shifts: 0 };
        return t('TOP_LINE', { rank: idx + 1, user: v.label, earned: v.totalEarned, shifts: v.shifts });
    });

    return lines.join('\n');
}

module.exports = {
    cooldown: Math.floor(getWorkCooldownMs() / 1000),
    Category: economyCategory,
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Trabaja para ganar monedas y experiencia')
        .addSubcommand((s) =>
            s
                .setName('list')
                .setDescription('Mira la lista de trabajos')
        )
        .addSubcommand((s) =>
            s
                .setName('apply')
                .setDescription('Aplica a un trabajo')
                .addStringOption((o) =>
                    o
                        .setName('trabajo')
                        .setDescription('ID o nombre del trabajo')
                        .setAutocomplete(true)
                        .setRequired(true)
                )
        )
        .addSubcommand((s) =>
            s
                .setName('leave')
                .setDescription('Renuncia a tu trabajo')
        )
        .addSubcommand((s) =>
            s
                .setName('shift')
                .setDescription('Completa un turno de trabajo')
        )
        .addSubcommand((s) =>
            s
                .setName('stats')
                .setDescription('Muestra tu progreso en el trabajo actual')
        )
        .addSubcommand((s) =>
            s
                .setName('top')
                .setDescription('Mira los mejores empleados de tu profesión')
        ),

    async autocomplete(Moxi, interaction) {
        try {
            const guildId = interaction.guildId || interaction.guild?.id;
            const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

            const focused = interaction.options.getFocused?.() ?? '';
            const q = String(focused || '')
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

            const jobs = listJobs();
            const matches = jobs
                .filter(j => {
                    if (!q) return true;
                    const id = String(j.id || '').toLowerCase();
                    const baseName = String(j.name || '').toLowerCase();
                    const displayName = String(getJobDisplayName(j, lang) || '').toLowerCase();
                    const norm = (s) => String(s || '')
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '');
                    return norm(id).includes(q) || norm(baseName).includes(q) || norm(displayName).includes(q);
                })
                .slice(0, 25)
                .map(j => {
                    const label = `${j.emoji || '💼'} ${getJobDisplayName(j, lang)} (${j.id})`;
                    return {
                        name: label.length > 100 ? label.slice(0, 97) + '...' : label,
                        value: String(j.id).slice(0, 100),
                    };
                });

            return interaction.respond(matches);
        } catch {
            // best-effort
            try { return interaction.respond([]); } catch { }
        }
    },

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/work:${k}`, lang, vars);

        const applicationId = process.env.CLIENT_ID || interaction.client?.application?.id;
        let workListMention = '/work list';
        let workApplyMention = '/work apply';
        if (applicationId) {
            try {
                workListMention = await slashMention({ name: 'work', subcommand: 'list', applicationId, guildId });
                workApplyMention = await slashMention({ name: 'work', subcommand: 'apply', applicationId, guildId });
            } catch {
                // keep fallbacks
            }
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'list') {
            const payload = buildWorkListMessageOptions({ lang, page: 0, userId: interaction.user.id });
            return interaction.reply(payload);
        }

        if (sub === 'apply') {
            const query = interaction.options.getString('trabajo', true);
            const job = resolveJob(query, lang);
            if (!job) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('JOB_NOT_FOUND_TITLE'),
                        text: `${t('JOB_NOT_FOUND_TEXT', { query })}\n${workListMention}`,
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            // Enviar panel de postulación adaptado al puesto (privado)
            const payload = buildWorkApplyMessageOptions({ lang, userId: interaction.user.id, job });
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (sub === 'leave') {
            const res = await leaveJob({ userId: interaction.user.id });
            if (!res.ok) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: res.message || t('UNKNOWN_ERROR'),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '👋',
                    title: t('LEAVE_TITLE'),
                    text: t('LEAVE_TEXT_SLASH', { apply: workApplyMention }),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (sub === 'shift') {
            const res = await doShift({ userId: interaction.user.id });

            if (!res.ok) {
                if (res.reason === 'cooldown') {
                    const show = shouldShowCooldownNotice({ userId: interaction.user.id, key: 'work', windowMs: 15_000, threshold: 3 });
                    const payload = asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.hourglass,
                            title: t('COOLDOWN_TITLE'),
                            text: show
                                ? t('COOLDOWN_TEXT', { next: res.nextInText, balance: res.balance })
                                : t('COOLDOWN_SOFT_TEXT', { balance: res.balance }),
                        })
                    );
                    return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
                }

                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('SHIFT_ERROR_TITLE'),
                        text: res.message || t('UNKNOWN_ERROR'),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '💰',
                    title: t('SHIFT_DONE_TITLE'),
                    text: t('SHIFT_DONE_TEXT', {
                        job: getJobDisplayName(res.job, lang),
                        emoji: res.job.emoji || '',
                        amount: res.amount,
                        balance: res.balance,
                    }),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (sub === 'stats') {
            const st = await getWorkStats({ userId: interaction.user.id });
            const cd = formatDuration(getWorkCooldownMs());
            const jobLine = st.job ? `**${getJobDisplayName(st.job, lang)}** ${st.job.emoji || ''}` : '—';
            const last = st.lastWork ? `<t:${Math.floor(st.lastWork.getTime() / 1000)}:R>` : '—';
            const next = st.nextInMs > 0 ? `en **${st.nextInText}**` : 'ahora';

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '📊',
                    title: t('STATS_TITLE'),
                    text:
                        `**${t('STATS_JOB')}:** ${jobLine}\n` +
                        `**${t('STATS_SHIFTS')}:** ${st.shifts}\n` +
                        `**${t('STATS_TOTAL_EARNED')}:** ${st.totalEarned}\n` +
                        `**${t('STATS_BALANCE')}:** ${st.balance}\n\n` +
                        `**${t('STATS_LAST_SHIFT')}:** ${last}\n` +
                        `**${t('STATS_NEXT_SHIFT')}:** ${next}\n` +
                        `**${t('STATS_COOLDOWN')}:** ${cd}`,
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (sub === 'top') {
            const st = await getWorkStats({ userId: interaction.user.id });
            if (!st.job) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('NO_JOB_FOR_TOP_TITLE'),
                        text: t('NO_JOB_FOR_TOP_TEXT', { apply: workApplyMention }),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const top = await getTopByJob({ jobId: st.job.id, limit: 10 });
            if (!top.ok) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: top.message || t('RANKING_ERROR'),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const body = top.rows.length
                ? await renderTop({ client: Moxi, rows: top.rows, lang })
                : t('TOP_EMPTY');

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🏆',
                    title: `Top • ${getJobDisplayName(st.job, lang)}`,
                    text: body,
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        const payload = asV2MessageOptions(
            buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: t('ERROR_TITLE'),
                text: t('INVALID_SUBCOMMAND_TEXT'),
            })
        );
        return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
    },
};
