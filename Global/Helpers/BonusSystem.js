const path = require('node:path');

const { Clvls } = require(path.join(__dirname, '..', '..', 'Models'));
const { normalizeDiscordId } = require(path.join(__dirname, '..', '..', 'Util', 'idGuards'));

const CONFIG_TTL_MS = 2 * 60 * 1000;
const cache = new Map(); // guildId -> { expiresAt, doc }

function now() {
    return Date.now();
}

function isSafeUpdateKey(key) {
    const normalized = String(key || '').trim();
    if (!normalized) return false;
    if (normalized.startsWith('$')) return false;
    if (normalized === '__proto__' || normalized === 'constructor' || normalized === 'prototype') return false;
    return true;
}

async function getConfig(guildID) {
    const gid = normalizeDiscordId(guildID);
    if (!gid) return null;

    const cached = cache.get(gid);
    const t = now();
    if (cached && cached.expiresAt > t) return cached.doc;

    const doc = await Clvls.findOneAndUpdate(
        { guildID: gid },
        { $setOnInsert: { guildID: gid } },
        { upsert: true, new: true }
    ).lean().catch(() => null);

    cache.set(gid, { expiresAt: t + CONFIG_TTL_MS, doc });
    return doc;
}

async function updateConfig(guildID, updates = {}) {
    const gid = normalizeDiscordId(guildID);
    if (!gid) return null;

    const safe = {};
    if (updates && typeof updates === 'object') {
        for (const [key, value] of Object.entries(updates)) {
            if (!isSafeUpdateKey(key)) continue;
            safe[key] = value;
        }
    }
    const doc = await Clvls.findOneAndUpdate(
        { guildID: gid },
        { $set: safe, $setOnInsert: { guildID: gid } },
        { upsert: true, new: true }
    ).lean().catch(() => null);

    cache.set(gid, { expiresAt: now() + CONFIG_TTL_MS, doc });
    return doc;
}

module.exports = {
    getConfig,
    updateConfig,
};
