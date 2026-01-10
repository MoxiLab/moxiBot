const path = require('node:path');

const { Clvls } = require(path.join(__dirname, '..', '..', 'Models'));

const CONFIG_TTL_MS = 2 * 60 * 1000;
const cache = new Map(); // guildId -> { expiresAt, doc }

function now() {
    return Date.now();
}

async function getConfig(guildID) {
    const gid = String(guildID || '').trim();
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
    const gid = String(guildID || '').trim();
    if (!gid) return null;

    const safe = (updates && typeof updates === 'object') ? updates : {};
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
