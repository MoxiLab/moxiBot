const { ContainerBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { Bot } = require('../Config');

function buildAfkContainer({ title, lines = [], gifUrl, gifLabel }) {
    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
    if (title) {
        container.addTextDisplayComponents(c => c.setContent(`# ${title}`));
        container.addSeparatorComponents(s => s.setDivider(true));
    }
    for (const line of lines) {
        container.addTextDisplayComponents(c => c.setContent(line));
    }
    if (gifUrl) {
        const builder = new MediaGalleryItemBuilder().setURL(gifUrl);
        const description = (gifLabel || '').trim();
        if (description) {
            builder.setDescription(description);
        }
        container.addSeparatorComponents(s => s.setDivider(true));
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(builder)
        );
    }
    return container;
}

function formatAfkTimestamp(value, locale = 'es-ES') {
    const date = toSafeDate(value) || new Date();
    const unixSeconds = Math.floor(date.getTime() / 1000);
    return `<t:${unixSeconds}:f>`;
}

function formatAfkDuration(value, locale = 'es-ES') {
    const date = toSafeDate(value) || new Date();
    const unixSeconds = Math.floor(date.getTime() / 1000);
    return `<t:${unixSeconds}:R>`;
}

function toSafeDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date;
}

module.exports = {
    buildAfkContainer,
    formatAfkTimestamp,
    formatAfkDuration,
};
