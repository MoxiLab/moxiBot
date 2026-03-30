const { ensureMongoConnection } = require('./mongoConnect');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

const COLLECTION = 'user_prefixes';
const CACHE_TTL_MS = Number.parseInt(process.env.USER_PREFIX_TTL_MS || '', 10) || (5 * 60 * 1000);
const cache = new Map();

function key(guildId, userId) {
  return `${String(guildId || '')}:${String(userId || '')}`;
}

function getCache(guildId, userId) {
  const hit = cache.get(key(guildId, userId));
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key(guildId, userId));
    return null;
  }
  return hit.value;
}

function setCache(guildId, userId, value) {
  cache.set(key(guildId, userId), {
    value: String(value || ''),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function invalidateUserPrefixCache(guildId, userId) {
  const gid = normalizeDiscordId(guildId);
  const uid = normalizeDiscordId(userId);
  if (!gid || !uid) return;
  cache.delete(key(gid, uid));
}

function buildQuery(gid, uid) {
  return {
    $and: [
      { $or: [{ guildID: gid }, { guildId: gid }, { id: gid }] },
      { $or: [{ userID: uid }, { userId: uid }, { uid: uid }] },
    ],
  };
}

async function getUserPrefix(guildId, userId, fallbackPrefix = '') {
  const gid = normalizeDiscordId(guildId);
  const uid = normalizeDiscordId(userId);
  if (!gid || !uid) return String(fallbackPrefix || '');

  const cached = getCache(gid, uid);
  if (cached !== null) return cached || String(fallbackPrefix || '');

  const conn = await ensureMongoConnection();
  const doc = await conn.db.collection(COLLECTION).findOne(buildQuery(gid, uid));
  const value = normalizeDbText(doc?.prefix, { maxLen: 20, fallback: '' });
  setCache(gid, uid, value);
  return value || String(fallbackPrefix || '');
}

async function setUserPrefix(guildId, userId, prefix) {
  const gid = normalizeDiscordId(guildId);
  const uid = normalizeDiscordId(userId);
  if (!gid || !uid) return false;

  const value = normalizeDbText(prefix, { maxLen: 20, fallback: '' });
  const conn = await ensureMongoConnection();
  const res = await conn.db.collection(COLLECTION).updateOne(
    buildQuery(gid, uid),
    {
      $set: {
        prefix: value,
        guildID: gid,
        userID: uid,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
        guildId: gid,
        userId: uid,
      },
    },
    { upsert: true }
  );

  const ok = res.matchedCount > 0 || res.upsertedCount > 0 || res.modifiedCount > 0;
  if (ok) setCache(gid, uid, value);
  return ok;
}

async function clearUserPrefix(guildId, userId) {
  const gid = normalizeDiscordId(guildId);
  const uid = normalizeDiscordId(userId);
  if (!gid || !uid) return false;

  const conn = await ensureMongoConnection();
  const res = await conn.db.collection(COLLECTION).deleteOne(buildQuery(gid, uid));
  invalidateUserPrefixCache(gid, uid);
  return (res.deletedCount || 0) > 0;
}

module.exports = {
  getUserPrefix,
  setUserPrefix,
  clearUserPrefix,
  invalidateUserPrefixCache,
};
