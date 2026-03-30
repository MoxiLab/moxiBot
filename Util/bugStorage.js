const Bug = require('../Models/BugSchema');
const { normalizeDiscordId } = require('./idGuards');

function isSafeUpdateKey(key) {
    const normalized = String(key || '').trim();
    if (!normalized) return false;
    if (normalized.startsWith('$')) return false;
    if (normalized.includes('.')) return false;
    if (normalized === '__proto__' || normalized === 'constructor' || normalized === 'prototype') return false;
    return true;
}

function buildSettingsUpdate(values = {}) {
    const update = { type: 'settings' };
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && isSafeUpdateKey(key)) {
            update[key] = value;
        }
    });
    return update;
}

async function getSettings(guildId) {
    const gid = normalizeDiscordId(guildId);
    if (!gid) return null;
    return Bug.findOne({ guildID: gid, type: 'settings' }).lean();
}

async function upsertSettings(guildId, values) {
    const gid = normalizeDiscordId(guildId);
    if (!gid) return false;
    const update = buildSettingsUpdate(values);
    const now = new Date();
    const result = await Bug.findOneAndUpdate(
        { guildID: gid, type: 'settings' },
        { $set: { ...update, updatedAt: now }, $setOnInsert: { guildID: gid, createdAt: now } },
        { upsert: true, new: true }
    );
    return result;
}

module.exports = {
    getSettings,
    upsertSettings,
};
