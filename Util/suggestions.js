const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionsBitField,
} = require('discord.js');

const { Bot } = require('../Config');

function isStaff(member) {
    const perms = member?.permissions;
    if (!perms) return false;
    return perms.has(PermissionsBitField.Flags.Administrator, true)
        || perms.has(PermissionsBitField.Flags.ManageGuild, true)
        || perms.has(PermissionsBitField.Flags.ManageChannels, true)
        || perms.has(PermissionsBitField.Flags.ManageMessages, true);
}

function normalizeSuggestionId(input) {
    return String(input || '').trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function statusLabel(status) {
    if (status === 'approved') return 'APROBADA';
    if (status === 'denied') return 'RECHAZADA';
    return 'PENDIENTE';
}

function statusColor(status) {
    if (status === 'approved') return 0x57F287;
    if (status === 'denied') return 0xED4245;
    return (Bot.AccentColor ?? 0x00d9ff);
}

function buildSuggestionEmbed({ guild, author, suggestionId, content, status, staff, reason }) {
    const embed = new EmbedBuilder()
        .setColor(statusColor(status))
        .setTitle(`Sugerencia #${suggestionId}`)
        .setDescription(content && content.length ? content : '-')
        .addFields(
            { name: 'Estado', value: statusLabel(status), inline: true },
            { name: 'Autor', value: author ? `${author}` : '-', inline: true },
        )
        .setTimestamp(new Date());

    if (guild?.name) {
        embed.setFooter({ text: guild.name });
    }

    if (staff) {
        embed.addFields({ name: 'Revisado por', value: String(staff), inline: true });
    }
    if (reason) {
        embed.addFields({ name: 'Motivo', value: String(reason).slice(0, 1024), inline: false });
    }

    return embed;
}

function buildSuggestionButtons({ suggestionId, disabled = false, status = 'pending' }) {
    const isDone = status === 'approved' || status === 'denied';
    const finalDisabled = disabled || isDone;

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`suggest:approve:${suggestionId}`)
            .setLabel('Aprobar')
            .setStyle(ButtonStyle.Success)
            .setDisabled(finalDisabled),
        new ButtonBuilder()
            .setCustomId(`suggest:deny:${suggestionId}`)
            .setLabel('Rechazar')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(finalDisabled),
    );
}

module.exports = {
    isStaff,
    normalizeSuggestionId,
    buildSuggestionEmbed,
    buildSuggestionButtons,
};
