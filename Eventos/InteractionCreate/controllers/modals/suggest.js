const { MessageFlags } = require('discord.js');

const Suggestions = require('../../../../Models/SuggestionsSchema');
const { isStaff, normalizeSuggestionId, buildSuggestionEmbed, buildSuggestionButtons } = require('../../../../Util/suggestions');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { EMOJIS } = require('../../../../Util/emojis');

module.exports = async function suggestModalHandler(interaction, Moxi) {
    if (!interaction.isModalSubmit || !interaction.isModalSubmit()) return false;

    const id = String(interaction.customId || '');
    if (!id.startsWith('suggest_modal:')) return false;

    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: 'Solo disponible en servidores.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    if (!isStaff(interaction.member)) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: 'No tienes permisos para revisar sugerencias.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    // customId: suggest_modal:<approved|denied>:<suggestionId>
    const parts = id.split(':');
    const action = parts[1];
    const suggestionId = normalizeSuggestionId(parts[2]);
    if (!['approved', 'denied'].includes(action) || !suggestionId) return true;

    const reasonRaw = interaction.fields?.getTextInputValue?.('reason');
    const reason = reasonRaw && String(reasonRaw).trim().length ? String(reasonRaw).trim() : null;

    const now = new Date();
    const updated = await Suggestions.findOneAndUpdate(
        { guildID: interaction.guildId, type: 'suggestion', suggestionId, status: 'pending' },
        {
            $set: {
                status: action,
                staffID: interaction.user?.id || null,
                staffTag: interaction.user?.tag || null,
                reason,
                updatedAt: now,
            },
        },
        { new: true }
    ).catch(() => null);

    if (!updated) {
        const existing = await Suggestions.findOne({ guildID: interaction.guildId, type: 'suggestion', suggestionId }).lean().catch(() => null);
        const msg = existing?.status === 'approved'
            ? 'Esta sugerencia ya está aprobada.'
            : existing?.status === 'denied'
                ? 'Esta sugerencia ya está rechazada.'
                : 'No encuentro esa sugerencia.';

        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.info, text: msg })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    // Edit original message
    if (updated.messageID && updated.messageChannelID) {
        const channel = interaction.guild.channels.cache.get(String(updated.messageChannelID))
            || await interaction.guild.channels.fetch(String(updated.messageChannelID)).catch(() => null);

        if (channel && channel.isTextBased && channel.isTextBased()) {
            const msg = await channel.messages.fetch(String(updated.messageID)).catch(() => null);
            if (msg) {
                const embed = buildSuggestionEmbed({
                    guild: interaction.guild,
                    author: updated.authorTag || (updated.authorID ? `<@${updated.authorID}>` : null),
                    suggestionId: updated.suggestionId,
                    content: updated.content,
                    status: updated.status,
                    staff: interaction.user?.tag || interaction.user?.id,
                    reason,
                });
                const row = buildSuggestionButtons({ suggestionId: updated.suggestionId, status: updated.status });
                await msg.edit({ embeds: [embed], components: [row] }).catch(() => null);
            }
        }
    }

    // DM best-effort
    if (updated.authorID) {
        const u = await Moxi.users.fetch(updated.authorID).catch(() => null);
        if (u) {
            const dmText = `Tu sugerencia #${updated.suggestionId} ha sido **${updated.status === 'approved' ? 'APROBADA' : 'RECHAZADA'}**${reason ? `\nMotivo: ${reason}` : ''}.`;
            u.send({ content: dmText }).catch(() => null);
        }
    }

    await interaction.reply({
        content: '',
        components: [buildNoticeContainer({ emoji: EMOJIS.tick, text: `Sugerencia #${updated.suggestionId} marcada como ${updated.status === 'approved' ? 'APROBADA' : 'RECHAZADA'}.` })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    }).catch(() => null);

    return true;
};
