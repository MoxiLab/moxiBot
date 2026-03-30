const { ensureMongoConnection } = require('../Util/mongoConnect');

const COLLECTION = 'bot_settings';
const DOC_KEY = 'maintenance';

function normalizeText(value, maxLen = 400) {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    if (!text) return '';
    return text.slice(0, maxLen);
}

function normalizeState(doc) {
    const enabled = !!doc?.enabled;
    const reason = normalizeText(doc?.reason, 500);
    const updatedBy = doc?.updatedBy ? String(doc.updatedBy) : '';
    const updatedByTag = doc?.updatedByTag ? String(doc.updatedByTag) : '';
    const updatedAt = doc?.updatedAt instanceof Date
        ? doc.updatedAt
        : (doc?.updatedAt ? new Date(doc.updatedAt) : null);

    return {
        enabled,
        reason,
        updatedBy,
        updatedByTag,
        updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
    };
}

async function getMaintenanceState() {
    const connection = await ensureMongoConnection();
    const db = connection.db;
    const doc = await db.collection(COLLECTION).findOne({ key: DOC_KEY });
    return normalizeState(doc || {});
}

async function setMaintenanceState({ enabled, reason, updatedBy, updatedByTag } = {}) {
    const connection = await ensureMongoConnection();
    const db = connection.db;

    const now = new Date();
    const nextEnabled = !!enabled;
    const nextReason = nextEnabled ? normalizeText(reason, 500) : '';
    const nextUpdatedBy = updatedBy ? String(updatedBy) : '';
    const nextUpdatedByTag = updatedByTag ? String(updatedByTag) : '';

    await db.collection(COLLECTION).updateOne(
        { key: DOC_KEY },
        {
            $setOnInsert: {
                key: DOC_KEY,
                createdAt: now,
            },
            $set: {
                enabled: nextEnabled,
                reason: nextReason,
                updatedBy: nextUpdatedBy,
                updatedByTag: nextUpdatedByTag,
                updatedAt: now,
            },
        },
        { upsert: true }
    );

    return {
        enabled: nextEnabled,
        reason: nextReason,
        updatedBy: nextUpdatedBy,
        updatedByTag: nextUpdatedByTag,
        updatedAt: now,
    };
}

module.exports = {
    getMaintenanceState,
    setMaintenanceState,
};
