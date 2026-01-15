function parseHexColor(input, fallback) {
    if (!input) return fallback;
    const raw = String(input).trim();
    const cleaned = raw.startsWith('0x')
        ? raw.slice(2)
        : raw.startsWith('#')
            ? raw.slice(1)
            : raw;
    const value = Number.parseInt(cleaned, 16);
    return Number.isFinite(value) ? value : fallback;
}

module.exports = {
    Bot: {
        Prefix: process.env.PREFIX ? [process.env.PREFIX, 'moxi'] : ['.', 'moxi'],
        Language: process.env.LANGUAGE || 'es-ES',
        AccentColor: parseHexColor(process.env.ACCENT_COLOR, 0xFFB6E6),
        // Alternativa a SLASH_MENTIONS_WITH_ID (útil si tu host no permite env vars)
        SlashMentionsWithId: true,
    }
};
