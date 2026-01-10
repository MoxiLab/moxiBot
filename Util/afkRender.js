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
    const date = value ? new Date(value) : new Date();
    const formatter = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
    return formatter.format(date);
}

function formatAfkDuration(value, locale = 'es-ES') {
    const reference = value ? new Date(value).valueOf() : Date.now();
    const now = Date.now();
    const delta = now - reference;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const units = [
        { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
        { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
        { unit: 'week', ms: 1000 * 60 * 60 * 24 * 7 },
        { unit: 'day', ms: 1000 * 60 * 60 * 24 },
        { unit: 'hour', ms: 1000 * 60 * 60 },
        { unit: 'minute', ms: 1000 * 60 },
        { unit: 'second', ms: 1000 },
    ];

    for (const { unit, ms } of units) {
        if (Math.abs(delta) >= ms || unit === 'second') {
            const amount = Math.round(delta / ms);
            return rtf.format(-amount, unit);
        }
    }

    return rtf.format(0, 'second');
}

module.exports = {
    buildAfkContainer,
    formatAfkTimestamp,
    formatAfkDuration,
};
