const Bug = require('../Models/Bug');

function buildSettingsUpdate(values = {}) {
    const update = { type: 'settings' };
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined) {
            update[key] = value;
        }
    });
    return update;
}

async function getSettings(guildId) {
    if (!guildId) return null;
    return Bug.findOne({ guildID: guildId, type: 'settings' }).lean();
}

async function upsertSettings(guildId, values) {
    if (!guildId) return false;
    const update = buildSettingsUpdate(values);
    const now = new Date();
    const result = await Bug.findOneAndUpdate(
        { guildID: guildId, type: 'settings' },
        { $set: { ...update, updatedAt: now }, $setOnInsert: { guildID: guildId, createdAt: now } },
        { upsert: true, new: true }
    );
    return result;
}

module.exports = {
    getSettings,
    upsertSettings,
};
