const { MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { buildAfkContainer } = require('../../Util/afkRender');
const { getRandomNekosGif } = require('../../Util/nekosApi');
const { getJobsList, resolveJobKey, validateJobRewards } = require('../../Util/workJobs');
const { doWork, msToHuman } = require('../../Util/workEconomy');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

async function resolveWorkGif() {
    const override = process.env.WORK_GIF_URL;
    if (override) return override;

    const category = (process.env.NEKOS_WORK_CATEGORIES || 'dance')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)[0] || 'dance';

    const url = await getRandomNekosGif(category);
    return url || process.env.AFK_FALLBACK_GIF_URL || null;
}

function jobsHelpText(prefix) {
    const jobs = getJobsList();
    const lines = jobs.map((j) => `• ${j.key} — ${j.label}`);
    return [
        'Elige un trabajo:',
        lines.join('\n'),
        '',
        `Ejemplo: \`${prefix}work minero\``,
    ].join('\n');
}

module.exports = {
    name: 'work',
    alias: ['trabajo', 'trabajar', 'job', 'jobs'],
    Category: economyCategory,
    usage: 'work <trabajo>',
    description: 'Trabaja para ganar monedas e ítems.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        try {
            validateJobRewards();
        } catch {
            // ignore
        }

        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const prefix = process.env.PREFIX || '.';

        const rawJob = args?.[0] ? String(args[0]) : '';
        if (!rawJob) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.briefcase || '💼',
                        title: 'Trabajos',
                        text: jobsHelpText(prefix),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const jobKey = resolveJobKey(rawJob);
        if (!jobKey) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Trabajo inválido',
                        text: jobsHelpText(prefix),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const out = await doWork({ userId: message.author.id, jobKey });

        if (!out.ok) {
            if (out.err?.code === 'COOLDOWN') {
                const left = msToHuman(out.err.retryAfterMs || 0);
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.hourglass || '⏳',
                            title: 'Descansa un poco',
                            text: `Aún estás cansado/a. Vuelve a trabajar en **${left}**.`,
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Error',
                        text: 'No pude completar el trabajo. Inténtalo de nuevo.',
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const gifUrl = await resolveWorkGif();
        const r = out.result;

        const lines = [
            `Trabajo: **${r.jobLabel}**`,
            r.activity,
            '',
            `Ganaste: **${Number(r.coins || 0).toLocaleString()}** 🪙`,
            r.itemId ? `Recompensa: **${r.itemAmount}x ${r.itemName || r.itemId}**` : 'Recompensa: _nada esta vez_',
        ];

        const container = buildAfkContainer({
            title: '💼 Trabajo completado',
            lines,
            gifUrl,
        });

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
