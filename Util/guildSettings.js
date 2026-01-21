// Redirigir a la implementación de Models/GuildSettings.js (MongoClient)
const {
  setGuildLanguage: setGuildLanguageRaw,
  getGuildSettings,
  setGuildPrefix: setGuildPrefixRaw,
  setGuildAuditChannel,
  setGuildAuditEnabled,
  setGuildEconomyEnabled: setGuildEconomyEnabledRaw,
  setGuildEconomyChannel: setGuildEconomyChannelRaw,
  setGuildEconomyExclusive: setGuildEconomyExclusiveRaw,
} = require('../Models/GuildSettings');

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

async function setGuildLanguage(guildId, lang, ownerId) {
  const ok = await setGuildLanguageRaw(guildId, lang, ownerId);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildPrefix(guildId, prefix) {
  const ok = await setGuildPrefixRaw(guildId, prefix);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildEconomyEnabled(guildId, enabled) {
  const ok = await setGuildEconomyEnabledRaw(guildId, enabled);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildEconomyChannel(guildId, channelId) {
  const ok = await setGuildEconomyChannelRaw(guildId, channelId);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

async function setGuildEconomyExclusive(guildId, exclusive) {
  const ok = await setGuildEconomyExclusiveRaw(guildId, exclusive);
  if (ok) invalidateGuildSettingsCache(guildId);
  return ok;
}

module.exports = {
  setGuildLanguage,
  getGuildSettings,
  setGuildPrefix,
  setGuildAuditChannel,
  setGuildAuditEnabled,
  setGuildEconomyEnabled,
  setGuildEconomyChannel,
  setGuildEconomyExclusive,
  getGuildSettingsCached,
  invalidateGuildSettingsCache
};
