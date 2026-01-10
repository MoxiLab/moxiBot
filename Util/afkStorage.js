const { ensureMongoConnection } = require('./mongoConnect');

const COLLECTION = 'afks';
const SCOPE_GLOBAL = 'global';
const SCOPE_GUILD = 'guild';

async function getCollection() {
    const connection = await ensureMongoConnection();
    return connection.db.collection(COLLECTION);
}

async function setAfk({ userId, guildId, message, scope = SCOPE_GUILD }) {
    const collection = await getCollection();
    const normalizedScope = scope === SCOPE_GLOBAL ? SCOPE_GLOBAL : SCOPE_GUILD;
    const now = new Date();
    const filter = { userId, scope: normalizedScope };
    if (normalizedScope === SCOPE_GUILD && !guildId) {
        throw new Error('Guild scope requires a guildId');
    }
    if (normalizedScope === SCOPE_GUILD) {
        filter.guildId = guildId;
    }
    const doc = {
        userId,
        scope: normalizedScope,
        guildId: normalizedScope === SCOPE_GUILD ? guildId : null,
        message,
        updatedAt: now,
    };
    const update = {
        $set: doc,
        $setOnInsert: { createdAt: now },
    };
    const result = await collection.findOneAndUpdate(filter, update, {
        upsert: true,
        returnDocument: 'after',
    });
    return result.value || { ...doc, createdAt: now };
}

async function getAfkEntry(userId, guildId) {
    const collection = await getCollection();
    if (guildId) {
        const guildEntry = await collection.findOne({ userId, scope: SCOPE_GUILD, guildId });
        if (guildEntry) return guildEntry;
    }
    return collection.findOne({ userId, scope: SCOPE_GLOBAL });
}

async function clearAfk(userId) {
    const collection = await getCollection();
    const result = await collection.deleteMany({ userId });
    return result.deletedCount > 0;
}

module.exports = {
    setAfk,
    getAfkEntry,
    clearAfk,
    SCOPE_GLOBAL,
    SCOPE_GUILD,
};
