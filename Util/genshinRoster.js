function normalizeCharacterKey(input) {
    return String(input || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function sanitizeCharacterName(input) {
    return String(input || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 48);
}

function buildUniqueRoster(rawList) {
    const list = Array.isArray(rawList) ? rawList : [];
    const seen = new Set();
    const output = [];

    for (const item of list) {
        const name = sanitizeCharacterName(item);
        if (!name) continue;
        const key = normalizeCharacterKey(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        output.push(name);
    }

    return output;
}

module.exports = {
    normalizeCharacterKey,
    sanitizeCharacterName,
    buildUniqueRoster,
};
