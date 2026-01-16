const { MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
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
    const jobs = listJobs();
    const lines = jobs.map(j => `${j.emoji || '💼'} **${getJobDisplayName(j, lang)}** — id: \`${j.id}\` — paga: **${j.min}–${j.max}**`);
    return lines.join('\n');
}

async function renderTop({ client, rows }) {
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
        return `**${idx + 1}.** ${v.label} — Ganado: **${v.totalEarned}** • Turnos: **${v.shifts}**`;
    });

    return lines.join('\n');
}

module.exports = {
    name: 'work',
    alias: ['w', 'trabajo', 'job'],
    Category: economyCategory,
    usage: 'work list | work apply <trabajo> | work leave | work shift | work stats | work top',
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

        const sub = normalizeSubcommand(args?.[0]);

        // Si el usuario ya eligió trabajo, `.work` debe hacer el turno directo.
        if (!sub) {
            const res = await doShift({ userId: message.author.id });

            if (!res.ok) {
                if (res.reason === 'cooldown') {
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.hourglass,
                                title: 'Aún no puedes trabajar',
                                text: `Te falta **${res.nextInText}** para tu próximo turno.\nSaldo: **${res.balance}**`,
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
                                title: 'Work',
                                text:
                                    `No tienes un trabajo activo.\n\n` +
                                    `Usa: \`work apply <trabajo>\` o \`work list\`\n` +
                                    `**Cooldown del turno:** ${cd}`,
                            })
                        )
                    );
                }

                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'No se pudo trabajar',
                            text: res.message || 'Error desconocido.',
                        })
                    )
                );
            }

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '💰',
                        title: 'Turno completado',
                        text: `Trabajo: **${getJobDisplayName(res.job, lang)}** ${res.job.emoji || ''}\nGanaste: **+${res.amount}**\nSaldo: **${res.balance}**`,
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
                            title: 'Elige un trabajo',
                            text: `${formatJobsList(lang)}\n\nEjemplo: \`work apply developer\``,
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
                            title: 'Trabajo no encontrado',
                            text: `No encontré el trabajo **${query}**. Usa \`work list\` para ver la lista.`,
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
                            title: 'Error',
                            text: res.message || 'No se pudo dejar el trabajo.',
                        })
                    )
                );
            }

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '👋',
                        title: 'Trabajo eliminado',
                        text: 'Has dejado tu trabajo. Usa `work apply <trabajo>` para elegir otro.',
                    })
                )
            );
        }

        if (sub === 'shift') {
            const res = await doShift({ userId: message.author.id });

            if (!res.ok) {
                if (res.reason === 'cooldown') {
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.hourglass,
                                title: 'Aún no puedes trabajar',
                                text: `Te falta **${res.nextInText}** para tu próximo turno.\nSaldo: **${res.balance}**`,
                            })
                        )
                    );
                }
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'No se pudo hacer el turno',
                            text: res.message || 'Error desconocido.',
                        })
                    )
                );
            }

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '💰',
                        title: 'Turno completado',
                        text: `Trabajo: **${getJobDisplayName(res.job, lang)}** ${res.job.emoji || ''}\nGanaste: **+${res.amount}**\nSaldo: **${res.balance}**`,
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
                        title: 'Work • Stats',
                        text:
                            `**Trabajo:** ${jobLine}\n` +
                            `**Turnos:** ${st.shifts}\n` +
                            `**Ganado total:** ${st.totalEarned}\n` +
                            `**Saldo:** ${st.balance}\n\n` +
                            `**Último turno:** ${last}\n` +
                            `**Siguiente turno:** ${next}\n` +
                            `**Cooldown:** ${cd}`,
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
                            title: 'Sin trabajo',
                            text: 'No tienes un trabajo activo. Usa `work apply <trabajo>` primero.',
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
                            title: 'Error',
                            text: top.message || 'No se pudo obtener el ranking.',
                        })
                    )
                );
            }

            const body = top.rows.length
                ? await renderTop({ client: Moxi, rows: top.rows })
                : 'Sin datos todavía.';

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
                    title: 'Subcomando inválido',
                    text: 'Usa: `work list | work apply <trabajo> | work leave | work shift | work stats | work top`',
                })
            )
        );
    },
};
