const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { parseWorkApplyCustomId, buildWorkHiredContainer } = require('../../../../Util/workApplyPanel');
const { resolveJob, applyJob } = require('../../../../Util/workSystem');

module.exports = async function workApplyButtons(interaction) {
    const parsed = parseWorkApplyCustomId(interaction?.customId);
    if (!parsed) return false;

    const { action, userId, jobId } = parsed;

    // Solo el autor puede usar los botones
    if (interaction.user?.id !== String(userId)) {
        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: 'Solo el autor puede usar estos botones.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    const job = resolveJob(jobId, lang);
    if (!job) {
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, title: 'Trabajo no encontrado', text: 'Este puesto ya no existe.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    if (action === 'cancel') {
        await interaction.update({
            content: '',
            components: [buildNoticeContainer({ emoji: '🗑️', title: 'Postulación cancelada', text: 'No se ha asignado ningún trabajo.' })],
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    if (action === 'confirm') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => null);
        }

        const res = await applyJob({ userId: interaction.user.id, jobId: job.id });
        if (!res.ok) {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: EMOJIS.cross, title: 'Error', text: res.message || 'No se pudo postular al trabajo.' })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        await interaction.editReply({
            content: '',
            components: [buildWorkHiredContainer({ lang, userId: interaction.user.id, job })],
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => null);

        return true;
    }

    return true;
};
