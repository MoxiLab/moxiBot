const { SlashCommandBuilder, MessageFlags } = require('discord.js');
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
    getTopBalances,
} = require('../../Util/workSystem');
const { formatDuration } = require('../../Util/economyCore');

function economyCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
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
                return { label: u.tag, userId: r.userId, balance: r.balance };
            } catch {
                return { label: r.userId, userId: r.userId, balance: r.balance };
            }
        })
    );

    const lines = resolved.map((p, idx) => {
        const v = p.status === 'fulfilled' ? p.value : { label: 'Unknown', userId: 'unknown', balance: 0 };
        return `**${idx + 1}.** ${v.label} — **${v.balance}**`;
    });

    return lines.join('\n');
}

module.exports = {
    cooldown: Math.floor(getWorkCooldownMs() / 1000),
    Category: economyCategory,
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Sistema de trabajo: aplica, haz turnos y gana monedas')
        .addSubcommand((s) =>
            s
                .setName('list')
                .setDescription('Muestra los trabajos disponibles')
        )
        .addSubcommand((s) =>
            s
                .setName('apply')
                .setDescription('Aplica a un trabajo')
                .addStringOption((o) =>
                    o
                        .setName('trabajo')
                        .setDescription('ID o nombre del trabajo (ej: developer)')
                        .setRequired(true)
                )
        )
        .addSubcommand((s) =>
            s
                .setName('leave')
                .setDescription('Deja tu trabajo actual')
        )
        .addSubcommand((s) =>
            s
                .setName('shift')
                .setDescription('Haz un turno para ganar monedas (con cooldown)')
        )
        .addSubcommand((s) =>
            s
                .setName('stats')
                .setDescription('Muestra tus estadísticas de trabajo')
        )
        .addSubcommand((s) =>
            s
                .setName('top')
                .setDescription('Muestra el top de saldo')
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const sub = interaction.options.getSubcommand();

        if (sub === 'list') {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '📋',
                    title: 'Trabajos disponibles',
                    text: formatJobsList(lang),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (sub === 'apply') {
            const query = interaction.options.getString('trabajo', true);
            const job = resolveJob(query, lang);
            if (!job) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Trabajo no encontrado',
                        text: `No encontré el trabajo **${query}**. Usa \`/work list\`.`,
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const res = await applyJob({ userId: interaction.user.id, jobId: job.id });
            if (!res.ok) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Error',
                        text: res.message || 'No se pudo aplicar al trabajo.',
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '✅',
                    title: 'Trabajo asignado',
                    text: `Ahora trabajas como **${getJobDisplayName(job, lang)}** ${job.emoji || ''}.\nUsa \`/work shift\` para tu turno.`,
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (sub === 'leave') {
            const res = await leaveJob({ userId: interaction.user.id });
            if (!res.ok) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Error',
                        text: res.message || 'No se pudo dejar el trabajo.',
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '👋',
                    title: 'Trabajo eliminado',
                    text: 'Has dejado tu trabajo. Usa `/work apply` para elegir otro.',
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (sub === 'shift') {
            const res = await doShift({ userId: interaction.user.id });

            if (!res.ok) {
                if (res.reason === 'cooldown') {
                    const payload = asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.hourglass,
                            title: 'Aún no puedes trabajar',
                            text: `Te falta **${res.nextInText}** para tu próximo turno.\nSaldo: **${res.balance}**`,
                        })
                    );
                    return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
                }

                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'No se pudo hacer el turno',
                        text: res.message || 'Error desconocido.',
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '💰',
                    title: 'Turno completado',
                    text: `Trabajo: **${getJobDisplayName(res.job, lang)}** ${res.job.emoji || ''}\nGanaste: **+${res.amount}**\nSaldo: **${res.balance}**`,
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
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (sub === 'top') {
            const top = await getTopBalances({ limit: 10 });
            if (!top.ok) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Error',
                        text: top.message || 'No se pudo obtener el ranking.',
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const body = top.rows.length
                ? await renderTop({ client: Moxi, rows: top.rows })
                : 'Sin datos todavía.';

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🏆',
                    title: 'Top economía (saldo)',
                    text: body,
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        const payload = asV2MessageOptions(
            buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'Error',
                text: 'Subcomando inválido.',
            })
        );
        return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
    },
};
