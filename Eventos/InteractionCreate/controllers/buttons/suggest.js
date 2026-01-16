const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const Suggestions = require('../../../../Models/SuggestionsSchema');
const { isStaff, normalizeSuggestionId } = require('../../../../Util/suggestions');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { EMOJIS } = require('../../../../Util/emojis');

function buildReasonModal({ action, suggestionId }) {
    const modal = new ModalBuilder()
        .setCustomId(`suggest_modal:${action}:${suggestionId}`)
        .setTitle(action === 'approved' ? 'Aprobar sugerencia' : 'Rechazar sugerencia');

    const input = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Motivo (opcional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

module.exports = async function suggestButtons(interaction, Moxi, logger) {
    const id = String(interaction.customId || '');
    if (!id.startsWith('suggest:')) return false;

    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: 'Solo disponible en servidores.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    const parts = id.split(':');
    const actionWord = parts[1];
    const suggestionId = normalizeSuggestionId(parts[2]);

    const action = actionWord === 'approve' ? 'approved' : (actionWord === 'deny' ? 'denied' : null);
    if (!action || !suggestionId) return true;

    if (!isStaff(interaction.member)) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: 'No tienes permisos para revisar sugerencias.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    // Si ya está resuelta, avisar (y best-effort deshabilitar botones si podemos)
    const doc = await Suggestions.findOne({ guildID: interaction.guildId, type: 'suggestion', suggestionId }).lean().catch(() => null);
    if (!doc) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: `No encuentro la sugerencia #${suggestionId}.` })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    // Si hay canal de revisión configurado, forzar a usarlo
    if (doc.staffMessageChannelID && interaction.channelId && String(interaction.channelId) !== String(doc.staffMessageChannelID)) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.info, text: `La revisión de sugerencias se hace en <#${doc.staffMessageChannelID}>.` })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    if (doc.status === 'approved' || doc.status === 'denied') {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.info, text: `Esta sugerencia ya está ${doc.status === 'approved' ? 'aprobada' : 'rechazada'}.` })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    const modal = buildReasonModal({ action, suggestionId });
    await interaction.showModal(modal).catch(async () => {
        // Si showModal falla, responder al menos
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: 'No pude abrir el formulario. Intenta de nuevo.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
    });

    return true;
};
