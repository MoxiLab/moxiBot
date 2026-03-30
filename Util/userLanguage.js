const { ensureMongoConnection } = require('./mongoConnect');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

const COLLECTION = 'user_languages';
const CACHE_TTL_MS = Number.parseInt(process.env.USER_LANG_TTL_MS || '', 10) || (5 * 60 * 1000);
const cache = new Map(); // key -> { value, expiresAt }

function buildKey(guildId, userId) {
  return `${String(guildId || '')}:${String(userId || '')}`;
}

function readCache(guildId, userId) {
  const key = buildKey(guildId, userId);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;
  if (hit) cache.delete(key);
  return null;
}

function writeCache(guildId, userId, value) {
  const key = buildKey(guildId, userId);
  cache.set(key, { value: String(value || ''), expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateUserLanguageCache(guildId, userId) {
  const gid = normalizeDiscordId(guildId);
  const uid = normalizeDiscordId(userId);
  if (!gid || !uid) return;
  cache.delete(buildKey(gid, uid));
}

async function getUserLanguage(guildId, userId, fallbackLang = '') {
  const gid = normalizeDiscordId(guildId);
  const uid = normalizeDiscordId(userId);
  if (!gid || !uid) return String(fallbackLang || '');

  const cached = readCache(gid, uid);
  if (cached !== null) return cached || String(fallbackLang || '');

  const conn = await ensureMongoConnection();
  const db = conn.db;
  const query = {
    $and: [
      { $or: [{ guildID: gid }, { guildId: gid }, { id: gid }] },
      { $or: [{ userID: uid }, { userId: uid }, { uid: uid }] },
    ],
  };

  const doc = await db.collection(COLLECTION).findOne(query);
  const lang = normalizeDbText(doc?.language, { maxLen: 16, fallback: '' });
  writeCache(gid, uid, lang);
  return lang || String(fallbackLang || '');
}

async function setUserLanguage(guildId, userId, lang) {
  const gid = normalizeDiscordId(guildId);
  const uid = normalizeDiscordId(userId);
  if (!gid || !uid) return false;

  const langCode = normalizeDbText(lang, { maxLen: 16, fallback: 'es-ES' });
  const conn = await ensureMongoConnection();
  const db = conn.db;

  const query = {
    $and: [
      { $or: [{ guildID: gid }, { guildId: gid }, { id: gid }] },
      { $or: [{ userID: uid }, { userId: uid }, { uid: uid }] },
    ],
  };

  const update = {
    $set: {
      language: langCode,
      guildID: gid,
      userID: uid,
      updatedAt: new Date(),
    },
    $setOnInsert: {
      createdAt: new Date(),
      guildId: gid,
      userId: uid,
    },
  };

  const res = await db.collection(COLLECTION).updateOne(query, update, { upsert: true });
  const ok = res.matchedCount > 0 || res.upsertedCount > 0 || res.modifiedCount > 0;
  if (ok) writeCache(gid, uid, langCode);
  return ok;
}

module.exports = {
  getUserLanguage,
  setUserLanguage,
  invalidateUserLanguageCache,
};
