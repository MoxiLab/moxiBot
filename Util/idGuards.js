function normalizeDiscordId(value) {
    const raw = String(value ?? '').trim();
    const match = raw.match(/\d{17,20}/);
    return match ? match[0] : '';
}

function normalizeDbText(value, { maxLen = 200, fallback = '' } = {}) {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;
    return raw.slice(0, Math.max(1, maxLen));
}

module.exports = {
    normalizeDiscordId,
    normalizeDbText,
};
