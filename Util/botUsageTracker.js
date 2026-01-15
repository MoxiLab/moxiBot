const COLLECTION_NAME = 'bot_usage_users';
const WRITE_TTL_MS = 5 * 60 * 1000;

const lastWriteByUser = new Map();

function isMongoEnabled() {
    const uri = process.env.MONGODB;
    return typeof uri === 'string' && uri.trim().length > 0;
}

function safeString(value, maxLen = 200) {
    if (value === undefined || value === null) return null;
    const s = String(value);
    if (!s) return null;
    return s.length > maxLen ? s.slice(0, maxLen) : s;
}

async function trackBotUserUsage({ userId, guildId, source, name }) {
    try {
        const uid = safeString(userId, 64);
        if (!uid) return false;
        if (!isMongoEnabled()) return false;

        const now = Date.now();
        const last = lastWriteByUser.get(uid) || 0;
        if (now - last < WRITE_TTL_MS) return false;
        lastWriteByUser.set(uid, now);

        const { ensureMongoConnection } = require('./mongoConnect');
        const connection = await ensureMongoConnection();
        const db = connection.db;

        const filter = { _id: uid };
        const update = {
            $set: {
                lastSeenAt: new Date(now),
                lastGuildId: safeString(guildId, 64),
                lastSource: safeString(source, 32),
                lastName: safeString(name, 200),
            },
            $setOnInsert: {
                firstSeenAt: new Date(now),
            },
            $inc: {
                uses: 1,
            },
        };

        await db.collection(COLLECTION_NAME).updateOne(filter, update, { upsert: true });
        return true;
    } catch {
        return false;
    }
}

async function getBotUserUsageCounts({ daysActive = 30 } = {}) {
    if (!isMongoEnabled()) return { enabled: false };

    const days = Number.isFinite(daysActive) && daysActive > 0 ? daysActive : 30;
    try {
        const { ensureMongoConnection } = require('./mongoConnect');
        const connection = await ensureMongoConnection();
        const db = connection.db;
        const col = db.collection(COLLECTION_NAME);

        const totalUsers = await col.estimatedDocumentCount().catch(() => col.countDocuments({}));

        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const activeUsers = await col.countDocuments({ lastSeenAt: { $gte: since } });

        return { enabled: true, totalUsers, activeUsers, daysActive: days };
    } catch {
        return { enabled: false };
    }
}

module.exports = {
    trackBotUserUsage,
    getBotUserUsageCounts,
};
