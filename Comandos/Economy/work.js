const { MessageFlags } = require('discord.js');
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

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

function normalizeSubcommand(v) {
    return String(v || '').trim().toLowerCase();
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
    name: 'work',
    alias: ['w', 'trabajo', 'job'],
    Category: economyCategory,
    usage: 'work list | work apply <id|nombre> | work leave | work shift | work stats | work top',
    description: 'Trabaja para ganar monedas y experiencia.',
    cooldown: Math.floor(getWorkCooldownMs() / 1000),
    permissions: {
        Bot: ['Ver canal', 'Enviar mensajes', 'Insertar enlaces'],
        User: [],
    },
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/work:${k}`, lang, vars);

        const sub = normalizeSubcommand(args?.[0]);

        // Si el usuario ya eligió trabajo, `.work` debe hacer el turno directo.
        if (!sub) {
            const res = await doShift({ userId: message.author.id });

            if (!res.ok) {
                if (res.reason === 'cooldown') {
                    if (!shouldShowCooldownNotice({ userId: message.author.id, key: 'work', windowMs: 15_000, threshold: 3 })) {
                        try { await message.react(EMOJIS.hourglass || '⏳'); } catch { }
                        return;
                    }
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.hourglass,
                                title: t('COOLDOWN_TITLE'),
                                text: t('COOLDOWN_TEXT', { next: res.nextInText, balance: res.balance }),
                            })
                        )
                    );
                }
                if (res.reason === 'no-job') {
                    const cd = formatDuration(getWorkCooldownMs());
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: '💼',
                                title: t('NO_JOB_TITLE'),
                                text: t('NO_JOB_TEXT', { cd }),
                            })
                        )
                    );
                }

                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('WORK_ERROR_TITLE'),
                            text: res.message || t('UNKNOWN_ERROR'),
                        })
                    )
                );
            }

            return message.reply({
                ...asV2MessageOptions(
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
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        if (sub === 'help') {
            const cd = formatDuration(getWorkCooldownMs());
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '💼',
                        title: 'Work',
                        text:
                            `**Subcomandos:** \`list\`, \`apply\`, \`leave\`, \`shift\`, \`stats\`, \`top\`\n` +
                            `**Cooldown del turno:** ${cd}\n\n` +
                            `Usa: \`${(process.env.PREFIX || '.')}help work\` para ver el panel.`,
                    })
                )
            );
        }

        if (sub === 'list') {
            const payload = buildWorkListMessageOptions({ lang, page: 0, userId: message.author.id });
            return message.reply({ ...payload, allowedMentions: { repliedUser: false } });
        }

        if (sub === 'apply') {
            const query = args?.slice(1).join(' ').trim();
            if (!query) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('APPLY_PICK_TITLE'),
                            text: `${formatJobsList(lang)}\n\n${t('APPLY_PICK_HINT')}`,
                        })
                    )
                );
            }

            const job = resolveJob(query, lang);
            if (!job) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('JOB_NOT_FOUND_TITLE'),
                            text: t('JOB_NOT_FOUND_TEXT', { query }),
                        })
                    )
                );
            }

            return message.reply(buildWorkApplyMessageOptions({ lang, userId: message.author.id, job }));
        }

        if (sub === 'leave') {
            const res = await leaveJob({ userId: message.author.id });
            if (!res.ok) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('ERROR_TITLE'),
                            text: res.message || t('UNKNOWN_ERROR'),
                        })
                    )
                );
            }

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '👋',
                        title: t('LEAVE_TITLE'),
                        text: t('LEAVE_TEXT'),
                    })
                )
            );
        }

        if (sub === 'shift') {
            const res = await doShift({ userId: message.author.id });

            if (!res.ok) {
                if (res.reason === 'cooldown') {
                    if (!shouldShowCooldownNotice({ userId: message.author.id, key: 'work', windowMs: 15_000, threshold: 3 })) {
                        try { await message.react(EMOJIS.hourglass || '⏳'); } catch { }
                        return;
                    }
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.hourglass,
                                title: t('COOLDOWN_TITLE'),
                                text: t('COOLDOWN_TEXT', { next: res.nextInText, balance: res.balance }),
                            })
                        )
                    );
                }
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('SHIFT_ERROR_TITLE'),
                            text: res.message || t('UNKNOWN_ERROR'),
                        })
                    )
                );
            }

            return message.reply({
                ...asV2MessageOptions(
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
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        if (sub === 'stats') {
            const st = await getWorkStats({ userId: message.author.id });
            const cd = formatDuration(getWorkCooldownMs());
            const jobLine = st.job ? `**${getJobDisplayName(st.job, lang)}** ${st.job.emoji || ''}` : '—';
            const last = st.lastWork ? `<t:${Math.floor(st.lastWork.getTime() / 1000)}:R>` : '—';
            const next = st.nextInMs > 0 ? `en **${st.nextInText}**` : 'ahora';

            return message.reply(
                asV2MessageOptions(
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
                )
            );
        }

        if (sub === 'top') {
            const st = await getWorkStats({ userId: message.author.id });
            if (!st.job) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('NO_JOB_FOR_TOP_TITLE'),
                            text: t('NO_JOB_FOR_TOP_TEXT', { apply: '`work apply <trabajo>`' }),
                        })
                    )
                );
            }

            const top = await getTopByJob({ jobId: st.job.id, limit: 10 });
            if (!top.ok) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('ERROR_TITLE'),
                            text: top.message || t('RANKING_ERROR'),
                        })
                    )
                );
            }

            const body = top.rows.length
                ? await renderTop({ client: Moxi, rows: top.rows, lang })
                : t('TOP_EMPTY');

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🏆',
                        title: `Top • ${getJobDisplayName(st.job, lang)}`,
                        text: body,
                    })
                )
            );
        }

        return message.reply(
            asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: t('INVALID_SUBCOMMAND_TITLE'),
                    text: t('INVALID_SUBCOMMAND_TEXT'),
                })
            )
        );
    },
};
