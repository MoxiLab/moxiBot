const { ensureMongoConnection } = require('./mongoConnect');
const StarboardModel = require('../Models/StarboardSchema');
const { normalizeDiscordId } = require('./idGuards');

function isSafeUpdateKey(key) {
    const normalized = String(key || '').trim();
    if (!normalized) return false;
    if (normalized.startsWith('$')) return false;
    if (normalized.includes('.')) return false;
    if (normalized === '__proto__' || normalized === 'constructor' || normalized === 'prototype') return false;
    return true;
}

function sanitizeUpdates(updates) {
    if (!updates || typeof updates !== 'object') return null;
    const output = {};
    for (const [key, value] of Object.entries(updates)) {
        if (!isSafeUpdateKey(key)) continue;
        output[key] = value;
    }
    return Object.keys(output).length ? output : null;
}

async function ensureConnection() {
    const connection = await ensureMongoConnection();
    return connection.db;
}

async function getStarboardSettings(guildId) {
    const gid = normalizeDiscordId(guildId);
    if (!gid) return null;
    await ensureConnection();
    return StarboardModel.findOne({ guildID: gid }).lean() || null;
}

async function updateStarboardSettings(guildId, updates) {
    const gid = normalizeDiscordId(guildId);
    const safeUpdates = sanitizeUpdates(updates);
    if (!gid || !safeUpdates) return null;
    await ensureConnection();
    const result = await StarboardModel.findOneAndUpdate(
        { guildID: gid },
        { $set: { ...safeUpdates, updatedAt: new Date() }, $setOnInsert: { guildID: gid, createdAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return result;
}

async function disableStarboard(guildId) {
    return updateStarboardSettings(guildId, { enabled: false });
}

module.exports = {
    getStarboardSettings,
    updateStarboardSettings,
    disableStarboard,
};
