const { MessageFlags } = require('discord.js');

const Suggestions = require('../../../../Models/SuggestionsSchema');
const { isStaff, normalizeSuggestionId, buildSuggestionCard } = require('../../../../Util/suggestions');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { EMOJIS } = require('../../../../Util/emojis');

function authorNameFromTag(tag) {
    if (!tag) return null;
    const str = String(tag);
    const idx = str.indexOf('#');
    return idx > 0 ? str.slice(0, idx) : str;
}

async function tryEditMessage(channel, messageId, payload) {
    if (!channel || !messageId) return false;
    try {
        if (channel.messages && typeof channel.messages.edit === 'function') {
            await channel.messages.edit(String(messageId), payload);
            return true;
        }
    } catch { }

    try {
        if (channel.messages && typeof channel.messages.fetch === 'function') {
            const msg = await channel.messages.fetch(String(messageId)).catch(() => null);
            if (msg) {
                await msg.edit(payload);
                return true;
            }
        }
    } catch { }

    return false;
}

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

    const footerText = `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`;
    const publicCard = buildSuggestionCard({
        content: updated.content,
        status: updated.status,
        withButtons: false,
        authorName: authorNameFromTag(updated.authorTag),
        footerText,
    });

    // Edit public/original message
    if (updated.messageID && updated.messageChannelID) {
        const channel = interaction.guild.channels.cache.get(String(updated.messageChannelID))
            || await interaction.guild.channels.fetch(String(updated.messageChannelID)).catch(() => null);

        if (channel && channel.isTextBased && channel.isTextBased()) {
            const edited = await tryEditMessage(channel, updated.messageID, { content: '', components: [publicCard], allowedMentions: { parse: [] } });

            // Fallback: si no se puede editar (permisos/historial), publicar actualización visible en el canal
            if (!edited) {
                const posted = await channel.send({
                    content: `${updated.status === 'approved' ? '✅' : '❌'} Actualización de sugerencia **#${updated.suggestionId}**`,
                    components: [publicCard],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                }).catch(() => null);

                if (posted) {
                    await Suggestions.updateOne(
                        { _id: updated._id },
                        { $set: { messageID: posted.id, messageChannelID: posted.channel.id, updatedAt: new Date() } }
                    ).catch(() => null);
                }
            }
        }
    }

    // Edit staff review message
    if (updated.staffMessageID && updated.staffMessageChannelID) {
        const staffChannel = interaction.guild.channels.cache.get(String(updated.staffMessageChannelID))
            || await interaction.guild.channels.fetch(String(updated.staffMessageChannelID)).catch(() => null);

        if (staffChannel && staffChannel.isTextBased && staffChannel.isTextBased()) {
            const linkUrl = updated.messageID ? `https://discord.com/channels/${interaction.guildId}/${updated.messageChannelID}/${updated.messageID}` : null;
            const staffCard = buildSuggestionCard({
                suggestionId: updated.suggestionId,
                content: updated.content,
                status: updated.status,
                linkUrl,
                withButtons: true,
                authorName: authorNameFromTag(updated.authorTag),
                footerText,
            });
            await tryEditMessage(staffChannel, updated.staffMessageID, { content: '', components: [staffCard], allowedMentions: { parse: [] } });
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
