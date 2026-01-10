// Redirigir a la implementación de Models/GuildSettings.js (MongoClient)
const { setGuildLanguage, getGuildSettings, setGuildPrefix, setGuildAuditChannel, setGuildAuditEnabled } = require('../Models/GuildSettings');

const DEFAULT_SETTINGS_TTL_MS = Number.parseInt(process.env.GUILD_SETTINGS_TTL_MS || '', 10) || (5 * 60 * 1000);
const guildSettingsCache = new Map();

async function getGuildSettingsCached(guildId, ttlMs = DEFAULT_SETTINGS_TTL_MS) {
  const now = Date.now();
  const cached = guildSettingsCache.get(guildId);
  if (cached && cached.expiresAt > now) return cached.settings;
  const settings = await getGuildSettings(guildId);
  guildSettingsCache.set(guildId, { settings, expiresAt: now + ttlMs });
  return settings;
}

function invalidateGuildSettingsCache(guildId) {
  if (!guildId) return;
  guildSettingsCache.delete(guildId);
}

module.exports = {
  setGuildLanguage,
  getGuildSettings,
  setGuildPrefix,
  setGuildAuditChannel,
  setGuildAuditEnabled,
  getGuildSettingsCached,
  invalidateGuildSettingsCache
};
