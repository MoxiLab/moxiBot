const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { buildAfkContainer } = require('../../Util/afkRender');
const { getRandomNekosGif } = require('../../Util/nekosApi');
const { getJobsList, resolveJobKey, validateJobRewards } = require('../../Util/workJobs');
const { doWork, msToHuman } = require('../../Util/workEconomy');

function economyCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
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

function jobsHelpText() {
    const jobs = getJobsList();
    const lines = jobs.map((j) => `• ${j.key} — ${j.label}`);
    return [
        'Elige un trabajo:',
        lines.join('\n'),
        '',
        'Ejemplo: `/work trabajo:minero`',
    ].join('\n');
}

module.exports = {
    cooldown: 0,
    Category: economyCategory,
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Trabaja para ganar monedas e ítems')
        .addStringOption((opt) => {
            const o = opt
                .setName('trabajo')
                .setDescription('Tipo de trabajo')
                .setRequired(false);

            // Mostrar choices amigables
            for (const j of getJobsList()) {
                o.addChoices({ name: j.label, value: j.key });
            }
            return o;
        })
        .addBooleanOption((opt) =>
            opt
                .setName('publico')
                .setDescription('Mostrar el resultado públicamente (por defecto: oculto)')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        // Validate reward ids at runtime once (fast)
        try {
            validateJobRewards();
        } catch {
            // ignore; we don't want to crash the command
        }

        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const rawJob = interaction.options.getString('trabajo');
        if (!rawJob) {
            return interaction.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.briefcase || '💼',
                        title: 'Trabajos',
                        text: jobsHelpText(),
                    })
                )
            );
        }

        const jobKey = resolveJobKey(rawJob);
        if (!jobKey) {
            return interaction.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Trabajo inválido',
                        text: jobsHelpText(),
                    })
                )
            );
        }

        const publicReply = interaction.options.getBoolean('publico') === true;
        const replyFlags = (publicReply ? 0 : MessageFlags.Ephemeral) | MessageFlags.IsComponentsV2;
        await interaction.deferReply({ flags: replyFlags });

        const out = await doWork({ userId: interaction.user.id, jobKey });

        if (!out.ok) {
            if (out.err?.code === 'COOLDOWN') {
                const left = msToHuman(out.err.retryAfterMs || 0);
                return interaction.editReply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.hourglass || '⏳',
                            title: 'Descansa un poco',
                            text: `Aún estás cansado/a. Vuelve a trabajar en **${left}**.`,
                        })
                    )
                );
            }

            return interaction.editReply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Error',
                        text: 'No pude completar el trabajo. Inténtalo de nuevo.',
                    })
                )
            );
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

        return interaction.editReply({
            content: '',
            components: [container],
            flags: replyFlags,
        });
    },
};
