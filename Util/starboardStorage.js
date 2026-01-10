const { ensureMongoConnection } = require('./mongoConnect');
const StarboardModel = require('../Models/StarboardSchema');

async function ensureConnection() {
    const connection = await ensureMongoConnection();
    return connection.db;
}

async function getStarboardSettings(guildId) {
    if (!guildId) return null;
    await ensureConnection();
    return StarboardModel.findOne({ guildID: guildId }).lean() || null;
}

async function updateStarboardSettings(guildId, updates) {
    if (!guildId || !updates || typeof updates !== 'object') return null;
    await ensureConnection();
    const result = await StarboardModel.findOneAndUpdate(
        { guildID: guildId },
        { $set: { ...updates, updatedAt: new Date() }, $setOnInsert: { guildID: guildId, createdAt: new Date() } },
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
