const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB;

function resolveMongoDbName(mongoUri) {
    const envDb = (process.env.MONGODB_DB || process.env.DB_NAME || '').trim();
    if (envDb) return envDb;
    try {
        const parsed = new URL(mongoUri);
        const path = (parsed.pathname || '').replace(/^\//, '');
        if (path) return decodeURIComponent(path);
    } catch (_) {
        // ignore invalid URIs and fall back to default
    }
    return 'admin';
}

const dbName = resolveMongoDbName(uri);
const collectionName = 'audit';

function normalizeId(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const str = String(value).trim();
    return str || null;
}

async function withCollection(fn) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        return await fn(collection);
    } finally {
        await client.close();
    }
}

async function getAuditSettings(guildId) {
    if (!guildId) return null;
    return withCollection(collection =>
        collection.findOne({ guildID: guildId }).then(doc => doc || null)
    );
}

async function setAuditChannel(guildId, channelId) {
    if (!guildId) throw new Error('guildId is required');
    return withCollection(async (collection) => {
        const now = new Date();
        const normalizedChannelId = normalizeId(channelId);
        const update = {
            $setOnInsert: { guildID: guildId, createdAt: now },
            $set: {
                updatedAt: now,
                channelId: normalizedChannelId,
                enabled: normalizedChannelId ? true : false,
            },
        };
        const result = await collection.updateOne({ guildID: guildId }, update, { upsert: true });
        return result.matchedCount > 0 || result.upsertedCount > 0;
    });
}

async function setAuditEnabled(guildId, enabled) {
    if (!guildId) throw new Error('guildId is required');
    return withCollection(async (collection) => {
        const now = new Date();
        const update = {
            $setOnInsert: { guildID: guildId, createdAt: now },
            $set: {
                updatedAt: now,
                enabled: !!enabled,
            },
        };
        const result = await collection.updateOne({ guildID: guildId }, update, { upsert: true });
        return result.matchedCount > 0 || result.upsertedCount > 0;
    });
}

async function deleteAuditSettings(guildId) {
    if (!guildId) return false;
    return withCollection(async (collection) => {
        const result = await collection.deleteOne({ guildID: guildId });
        return result.deletedCount > 0;
    });
}

module.exports = {
    getAuditSettings,
    setAuditChannel,
    setAuditEnabled,
    deleteAuditSettings,
};
