const { ensureMongoConnection } = require('./mongoConnect');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

const RULE_COLLECTION = 'blacklist_rules';
const LOG_COLLECTION = 'blacklist_audit';
const SETTINGS_COLLECTION = 'blacklist_settings';
let ensureIndexesPromise = null;

function normalizeId(value) {
    return normalizeDiscordId(value);
}

function normalizeScope(scope) {
    const clean = String(scope || '').trim().toLowerCase();
    if (clean === 'local' || clean === 'guild') return 'guild';
    if (clean === 'global') return 'global';
    return '';
}

function normalizeTargetType(targetType) {
    const clean = String(targetType || '').trim().toLowerCase();
    if (clean === 'user' || clean === 'usuario') return 'user';
    if (clean === 'guild' || clean === 'server' || clean === 'servidor') return 'guild';
    return '';
}

function normalizeActions(actions) {
    if (!actions) return ['all'];
    const raw = Array.isArray(actions)
        ? actions
        : String(actions).split(',');
    const cleaned = raw
        .map(item => String(item || '').trim().toLowerCase())
        .filter(Boolean);
    return cleaned.length ? cleaned : ['all'];
}

function normalizeIdList(items) {
    if (!Array.isArray(items)) return [];
    const out = items
        .map(value => normalizeId(value))
        .filter(Boolean);
    return Array.from(new Set(out));
}

function normalizeStringList(items) {
    if (!Array.isArray(items)) return [];
    const out = items
        .map(value => String(value || '').trim().toLowerCase())
        .filter(Boolean);
    return Array.from(new Set(out));
}

const ACTION_GROUPS = {
    interaction: new Set(['interaction', 'button', 'select', 'modal', 'autocomplete']),
    command: new Set(['command', 'prefix', 'slash']),
    message: new Set(['message', 'ai']),
    music: new Set(['music', 'button']),
};

function isActionBlocked(ruleActions, action) {
    const normalized = normalizeActions(ruleActions);
    if (normalized.includes('all')) return true;
    const cleanAction = String(action || '').trim().toLowerCase();
    if (!cleanAction) return false;
    if (normalized.includes(cleanAction)) return true;

    for (const [group, groupSet] of Object.entries(ACTION_GROUPS)) {
        if (groupSet.has(cleanAction) && normalized.includes(group)) return true;
    }

    return false;
}

function normalizeLevel(level) {
    const raw = Number(level);
    if (!Number.isFinite(raw)) return 3;
    return Math.max(1, Math.min(5, Math.round(raw)));
}

function normalizeExpiresAt({ expiresAt, durationMs } = {}) {
    if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0) {
        return new Date(Date.now() + durationMs);
    }
    if (!expiresAt) return null;
    const dt = new Date(expiresAt);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
}

async function ensureIndexes(db) {
    if (ensureIndexesPromise) return ensureIndexesPromise;

    ensureIndexesPromise = (async () => {
        const col = db.collection(RULE_COLLECTION);
        await col.createIndex(
            { scope: 1, guildId: 1, targetType: 1, targetId: 1 },
            { unique: true, name: 'scope_guild_target_unique' }
        );
        await col.createIndex({ scope: 1, targetType: 1, targetId: 1 }, { name: 'scope_target_idx' });
        await col.createIndex({ targetType: 1, targetId: 1 }, { name: 'target_idx' });
        await col.createIndex({ createdAt: -1 }, { name: 'createdAt_desc_idx' });
        await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_ttl_idx' });

        const logCol = db.collection(LOG_COLLECTION);
        await logCol.createIndex({ createdAt: -1 }, { name: 'createdAt_desc_idx' });
        await logCol.createIndex({ userId: 1, createdAt: -1 }, { name: 'user_createdAt_idx' });
        await logCol.createIndex({ guildId: 1, createdAt: -1 }, { name: 'guild_createdAt_idx' });
        await logCol.createIndex({ eventType: 1, createdAt: -1 }, { name: 'event_createdAt_idx' });

        const settingsCol = db.collection(SETTINGS_COLLECTION);
        await settingsCol.createIndex({ scope: 1, guildId: 1 }, { unique: true, name: 'scope_guild_unique' });
    })();

    return ensureIndexesPromise;
}

async function getRulesCollection() {
    const connection = await ensureMongoConnection();
    const db = connection.db;
    await ensureIndexes(db);
    return db.collection(RULE_COLLECTION);
}

async function getLogsCollection() {
    const connection = await ensureMongoConnection();
    const db = connection.db;
    await ensureIndexes(db);
    return db.collection(LOG_COLLECTION);
}

async function getSettingsCollection() {
    const connection = await ensureMongoConnection();
    const db = connection.db;
    await ensureIndexes(db);
    return db.collection(SETTINGS_COLLECTION);
}

function buildEntryQuery({ scope, guildId, targetType, targetId }) {
    const cleanScope = normalizeScope(scope);
    const cleanTargetType = normalizeTargetType(targetType);
    const cleanTargetId = normalizeId(targetId);
    const cleanGuildId = cleanScope === 'guild' ? normalizeId(guildId) : null;

    if (!cleanScope || !cleanTargetType || !cleanTargetId) return null;
    if (cleanScope === 'guild' && !cleanGuildId) return null;
    if (cleanScope === 'guild' && cleanTargetType !== 'user') return null;

    return {
        scope: cleanScope,
        guildId: cleanScope === 'guild' ? cleanGuildId : null,
        targetType: cleanTargetType,
        targetId: cleanTargetId,
    };
}

async function upsertBlacklistEntry({
    scope,
    guildId = null,
    targetType,
    targetId,
    reason = '',
    createdBy = null,
    level = 3,
    expiresAt = null,
    durationMs = null,
    actions = null,
} = {}) {
    const query = buildEntryQuery({ scope, guildId, targetType, targetId });
    if (!query) throw new Error('BLACKLIST_ENTRY_INVALID');

    const cleanBy = normalizeId(createdBy) || null;
    const now = new Date();
    const expires = normalizeExpiresAt({ expiresAt, durationMs });

    const update = {
        $set: {
            reason: normalizeDbText(reason, { maxLen: 500, fallback: '' }),
            level: normalizeLevel(level),
            actions: normalizeActions(actions),
            expiresAt: expires,
            updatedAt: now,
            updatedBy: cleanBy,
        },
        $setOnInsert: {
            createdAt: now,
            createdBy: cleanBy,
        },
    };

    const col = await getRulesCollection();
    const res = await col.updateOne(query, update, { upsert: true });
    return res.matchedCount > 0 || res.upsertedCount > 0;
}

async function removeBlacklistEntry({ scope, guildId = null, targetType, targetId } = {}) {
    const query = buildEntryQuery({ scope, guildId, targetType, targetId });
    if (!query) return false;

    const col = await getRulesCollection();
    const res = await col.deleteOne(query);
    return res.deletedCount > 0;
}

async function getBlacklistEntry({ scope, guildId = null, targetType, targetId } = {}) {
    const query = buildEntryQuery({ scope, guildId, targetType, targetId });
    if (!query) return null;

    const col = await getRulesCollection();
    const doc = await col.findOne(query, {
        projection: {
            scope: 1,
            guildId: 1,
            targetType: 1,
            targetId: 1,
            reason: 1,
            level: 1,
            actions: 1,
            createdBy: 1,
            createdAt: 1,
            updatedBy: 1,
            updatedAt: 1,
            expiresAt: 1,
        },
    });

    if (!doc) return null;

    if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) {
        await col.deleteOne({ _id: doc._id }).catch(() => null);
        return null;
    }

    return doc;
}

async function listBlacklistEntries({ scope, guildId = null, targetType = null, limit = 25 } = {}) {
    const cleanScope = normalizeScope(scope);
    const cleanGuildId = cleanScope === 'guild' ? normalizeId(guildId) : null;
    const cleanTargetType = targetType ? normalizeTargetType(targetType) : null;
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));

    if (!cleanScope) return [];
    if (cleanScope === 'guild' && !cleanGuildId) return [];
    if (targetType && !cleanTargetType) return [];

    const now = new Date();
    const query = {
        scope: cleanScope,
        guildId: cleanScope === 'guild' ? cleanGuildId : null,
        ...(cleanTargetType ? { targetType: cleanTargetType } : {}),
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };

    const col = await getRulesCollection();
    return await col
        .find(query, {
            projection: {
                scope: 1,
                guildId: 1,
                targetType: 1,
                targetId: 1,
                reason: 1,
                level: 1,
                actions: 1,
                createdBy: 1,
                createdAt: 1,
                updatedBy: 1,
                updatedAt: 1,
                expiresAt: 1,
            },
        })
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .toArray();
}

async function getBlacklistSettings({ guildId = null } = {}) {
    const cleanGuildId = normalizeId(guildId) || null;
    const col = await getSettingsCollection();

    const empty = {
        logChannelId: null,
        bypassUserIds: [],
        bypassRoleIds: [],
        bypassCommands: [],
        bypassActions: [],
    };

    const [globalDoc, guildDoc] = await Promise.all([
        col.findOne({ scope: 'global', guildId: null }) || null,
        cleanGuildId ? col.findOne({ scope: 'guild', guildId: cleanGuildId }) : null,
    ]);

    const normalizeSettings = (doc) => {
        if (!doc) return { ...empty };
        return {
            logChannelId: normalizeId(doc.logChannelId) || null,
            bypassUserIds: normalizeIdList(doc.bypassUserIds),
            bypassRoleIds: normalizeIdList(doc.bypassRoleIds),
            bypassCommands: normalizeStringList(doc.bypassCommands),
            bypassActions: normalizeStringList(doc.bypassActions),
        };
    };

    const globalSettings = normalizeSettings(globalDoc);
    const guildSettings = normalizeSettings(guildDoc);

    return {
        global: globalSettings,
        guild: guildSettings,
        merged: {
            logChannelId: guildSettings.logChannelId || globalSettings.logChannelId || null,
            bypassUserIds: Array.from(new Set([...globalSettings.bypassUserIds, ...guildSettings.bypassUserIds])),
            bypassRoleIds: Array.from(new Set([...globalSettings.bypassRoleIds, ...guildSettings.bypassRoleIds])),
            bypassCommands: Array.from(new Set([...globalSettings.bypassCommands, ...guildSettings.bypassCommands])),
            bypassActions: Array.from(new Set([...globalSettings.bypassActions, ...guildSettings.bypassActions])),
        },
    };
}

async function upsertBlacklistSettings({ scope, guildId = null, patch = {} } = {}) {
    const cleanScope = String(scope || '').trim().toLowerCase();
    const useScope = cleanScope === 'global' ? 'global' : 'guild';
    const cleanGuildId = useScope === 'guild' ? normalizeId(guildId) : null;
    if (useScope === 'guild' && !cleanGuildId) return false;

    const set = { updatedAt: new Date() };
    if ('logChannelId' in patch) set.logChannelId = normalizeId(patch.logChannelId) || null;
    if ('bypassUserIds' in patch) set.bypassUserIds = normalizeIdList(patch.bypassUserIds);
    if ('bypassRoleIds' in patch) set.bypassRoleIds = normalizeIdList(patch.bypassRoleIds);
    if ('bypassCommands' in patch) set.bypassCommands = normalizeStringList(patch.bypassCommands);
    if ('bypassActions' in patch) set.bypassActions = normalizeStringList(patch.bypassActions);

    const update = {
        $set: set,
        $setOnInsert: {
            scope: useScope,
            guildId: useScope === 'guild' ? cleanGuildId : null,
            createdAt: new Date(),
        },
    };

    const col = await getSettingsCollection();
    const res = await col.updateOne(
        { scope: useScope, guildId: useScope === 'guild' ? cleanGuildId : null },
        update,
        { upsert: true }
    );
    return res.matchedCount > 0 || res.upsertedCount > 0;
}

function shouldBypass({ settings, userId, roleIds, commandName, action }) {
    if (!settings) return false;
    const cleanUserId = normalizeId(userId);
    if (cleanUserId && settings.bypassUserIds.includes(cleanUserId)) return true;

    const normalizedRoles = normalizeIdList(roleIds || []);
    if (normalizedRoles.length && settings.bypassRoleIds.some((id) => normalizedRoles.includes(id))) return true;

    const cleanCommand = String(commandName || '').trim().toLowerCase();
    if (cleanCommand && settings.bypassCommands.includes(cleanCommand)) return true;

    const cleanAction = String(action || '').trim().toLowerCase();
    if (cleanAction && settings.bypassActions.includes(cleanAction)) return true;

    return false;
}

async function resolveBlacklistBlock({
    guildId = null,
    userId = null,
    action = 'unknown',
    commandName = null,
    roleIds = [],
    ignoreBypass = false,
} = {}) {
    const cleanUserId = normalizeId(userId);
    const cleanGuildId = normalizeId(guildId);

    const settings = await getBlacklistSettings({ guildId: cleanGuildId });
    if (!ignoreBypass && shouldBypass({ settings: settings.merged, userId: cleanUserId, roleIds, commandName, action })) {
        return { blocked: false, bypassed: true };
    }

    if (cleanGuildId) {
        const guildEntry = await getBlacklistEntry({
            scope: 'global',
            targetType: 'guild',
            targetId: cleanGuildId,
        });
        if (guildEntry && isActionBlocked(guildEntry.actions, action)) {
            return { blocked: true, scope: 'global', targetType: 'guild', entry: guildEntry };
        }
    }

    if (cleanUserId) {
        const globalUserEntry = await getBlacklistEntry({
            scope: 'global',
            targetType: 'user',
            targetId: cleanUserId,
        });
        if (globalUserEntry && isActionBlocked(globalUserEntry.actions, action)) {
            return { blocked: true, scope: 'global', targetType: 'user', entry: globalUserEntry };
        }
    }

    if (cleanGuildId && cleanUserId) {
        const localUserEntry = await getBlacklistEntry({
            scope: 'guild',
            guildId: cleanGuildId,
            targetType: 'user',
            targetId: cleanUserId,
        });
        if (localUserEntry && isActionBlocked(localUserEntry.actions, action)) {
            return { blocked: true, scope: 'guild', targetType: 'user', entry: localUserEntry };
        }
    }

    return { blocked: false };
}

async function emitBlacklistLog({ client, channelId, content }) {
    if (!client || !channelId || !content) return false;
    try {
        const ch = client.channels?.cache?.get(channelId)
            || await client.channels?.fetch?.(channelId).catch(() => null);
        if (!ch || typeof ch.send !== 'function') return false;
        await ch.send({ content, allowedMentions: { parse: [] } }).catch(() => null);
        return true;
    } catch {
        return false;
    }
}

async function logBlacklistHit({
    client = null,
    userId = null,
    guildId = null,
    action = 'unknown',
    source = null,
    commandName = null,
    entry = null,
} = {}) {
    const cleanUserId = normalizeId(userId);
    if (!cleanUserId || !entry) return false;

    const cleanGuildId = normalizeId(guildId) || null;
    const log = {
        eventType: 'block',
        userId: cleanUserId,
        guildId: cleanGuildId,
        action: String(action || 'unknown'),
        source: source ? String(source) : null,
        commandName: commandName ? String(commandName).slice(0, 100) : null,
        scope: entry.scope || null,
        targetType: entry.targetType || null,
        targetId: entry.targetId || null,
        level: entry.level || null,
        entryId: entry._id || null,
        createdAt: new Date(),
    };

    try {
        const col = await getLogsCollection();
        await col.insertOne(log);
    } catch {
        // ignore
    }

    const settings = await getBlacklistSettings({ guildId: cleanGuildId });
    const logTargets = [settings.guild.logChannelId, settings.global.logChannelId].filter(Boolean);
    if (!logTargets.length) return true;

    const msg = [
        'Blacklist bloqueo detectado',
        `User: <@${cleanUserId}> (${cleanUserId})`,
        cleanGuildId ? `Guild: ${cleanGuildId}` : 'Guild: n/a',
        `Scope: ${entry.scope || 'n/a'}`,
        `Target: ${entry.targetType || 'n/a'} ${entry.targetId || ''}`.trim(),
        `Action: ${action || 'unknown'}`,
        commandName ? `Command: ${commandName}` : null,
        entry.reason ? `Reason: ${entry.reason}` : null,
        typeof entry.level === 'number' ? `Level: ${entry.level}` : null,
    ].filter(Boolean).join('\n');

    for (const channelId of logTargets) {
        await emitBlacklistLog({ client, channelId, content: msg });
    }

    return true;
}

async function addLocalBlacklist({ guildId, userId, reason = '', createdBy = null, level = 3, expiresAt = null, durationMs = null } = {}) {
    return upsertBlacklistEntry({
        scope: 'guild',
        guildId,
        targetType: 'user',
        targetId: userId,
        reason,
        createdBy,
        level,
        expiresAt,
        durationMs,
    });
}

async function removeLocalBlacklist({ guildId, userId } = {}) {
    return removeBlacklistEntry({ scope: 'guild', guildId, targetType: 'user', targetId: userId });
}

async function isUserLocallyBlacklisted({ guildId, userId } = {}) {
    const entry = await getBlacklistEntry({ scope: 'guild', guildId, targetType: 'user', targetId: userId });
    return Boolean(entry);
}

async function listLocalBlacklist({ guildId, limit = 25 } = {}) {
    return listBlacklistEntries({ scope: 'guild', guildId, targetType: 'user', limit });
}

async function addGlobalBlacklist({ userId, reason = '', createdBy = null, level = 3, expiresAt = null, durationMs = null } = {}) {
    return upsertBlacklistEntry({
        scope: 'global',
        targetType: 'user',
        targetId: userId,
        reason,
        createdBy,
        level,
        expiresAt,
        durationMs,
    });
}

async function removeGlobalBlacklist({ userId } = {}) {
    return removeBlacklistEntry({ scope: 'global', targetType: 'user', targetId: userId });
}

async function isUserGloballyBlacklisted({ userId } = {}) {
    const entry = await getBlacklistEntry({ scope: 'global', targetType: 'user', targetId: userId });
    return Boolean(entry);
}

async function listGlobalBlacklist({ limit = 25, targetType = 'user' } = {}) {
    return listBlacklistEntries({ scope: 'global', targetType, limit });
}

async function addGlobalGuildBlacklist({ guildId, reason = '', createdBy = null, level = 3, expiresAt = null, durationMs = null } = {}) {
    return upsertBlacklistEntry({
        scope: 'global',
        targetType: 'guild',
        targetId: guildId,
        reason,
        createdBy,
        level,
        expiresAt,
        durationMs,
    });
}

async function removeGlobalGuildBlacklist({ guildId } = {}) {
    return removeBlacklistEntry({ scope: 'global', targetType: 'guild', targetId: guildId });
}

async function isGuildGloballyBlacklisted({ guildId } = {}) {
    const entry = await getBlacklistEntry({ scope: 'global', targetType: 'guild', targetId: guildId });
    return Boolean(entry);
}

module.exports = {
    normalizeId,
    normalizeScope,
    normalizeTargetType,
    normalizeActions,
    upsertBlacklistEntry,
    removeBlacklistEntry,
    getBlacklistEntry,
    listBlacklistEntries,
    getBlacklistSettings,
    upsertBlacklistSettings,
    resolveBlacklistBlock,
    logBlacklistHit,
    addLocalBlacklist,
    removeLocalBlacklist,
    isUserLocallyBlacklisted,
    listLocalBlacklist,
    addGlobalBlacklist,
    removeGlobalBlacklist,
    isUserGloballyBlacklisted,
    listGlobalBlacklist,
    addGlobalGuildBlacklist,
    removeGlobalGuildBlacklist,
    isGuildGloballyBlacklisted,
};
