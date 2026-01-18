const {
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    PermissionsBitField,
} = require('discord.js');

const { Bot } = require('../Config');
const moxi = require('../i18n');

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

function statusIcon(status) {
    if (status === 'approved') return '✅';
    if (status === 'denied') return '❌';
    return '💡';
}

function buildSuggestionCard({ lang = 'es-ES', suggestionId = null, content, status = 'pending', linkUrl = null, withButtons = false, authorName = null, footerText = null } = {}) {
    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor ?? 0x00d9ff);

    const title = moxi.translate('misc:SUGGESTIONS_TITLE', lang) || (lang === 'en-US' ? 'Suggestion' : 'Sugerencia');
    container.addTextDisplayComponents(c => c.setContent(`# ${statusIcon(status)} ${title}`));
    container.addSeparatorComponents(s => s.setDivider(true));

    if (linkUrl) {
        container.addTextDisplayComponents(c => c.setContent(`🔗 ${linkUrl}`));
        container.addSeparatorComponents(s => s.setDivider(true));
    }

    container.addTextDisplayComponents(c => c.setContent(content && content.length ? String(content) : '-'));

    if (withButtons) {
        const isDone = status === 'approved' || status === 'denied';
        if (!suggestionId) {
            throw new Error('buildSuggestionCard: suggestionId required when withButtons=true');
        }
        container.addSeparatorComponents(s => s.setDivider(true));
        container.addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`suggest:approve:${suggestionId}`)
                    .setLabel(moxi.translate('APPROVE', lang) || 'Aprobar')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(isDone),
                new ButtonBuilder()
                    .setCustomId(`suggest:deny:${suggestionId}`)
                    .setLabel(moxi.translate('REJECT', lang) || 'Rechazar')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(isDone),
            )
        );
    }

    if (authorName || footerText) {
        container.addSeparatorComponents(s => s.setDivider(true));
    }

    if (authorName) {
        container.addTextDisplayComponents(c => c.setContent(String(authorName)));
    }

    if (footerText) {
        if (authorName) {
            container.addSeparatorComponents(s => s.setDivider(true));
        }
        container.addTextDisplayComponents(c => c.setContent(String(footerText)));
    }

    return container;
}

module.exports = {
    isStaff,
    normalizeSuggestionId,
    buildSuggestionCard,
};
