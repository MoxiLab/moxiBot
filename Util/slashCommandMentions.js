const { REST, Routes } = require('discord.js');
const logger = require('./logger');

// Por defecto NO usamos IDs para menciones (evita depender de Mongo / sync).
// Si quieres volver a menciones reales tipo </bug:ID>, activa:
//   SLASH_MENTIONS_WITH_ID=true
function isUsingSlashCommandIds() {
  const env = process.env.SLASH_MENTIONS_WITH_ID;
  if (env === 'true') return true;
  if (env === 'false') return false;

  try {
    // eslint-disable-next-line global-require
    const Config = require('../Config');
    if (typeof Config?.Bot?.SlashMentionsWithId === 'boolean') return Config.Bot.SlashMentionsWithId;
  } catch {
    // ignore
  }

  return false;
}

const USE_SLASH_COMMAND_IDS = isUsingSlashCommandIds();

// In-memory cache for fast lookups.
// Key: `${applicationId}:${guildId||'global'}:${name}` => commandId
const CACHE = new Map();

function cacheKey({ applicationId, guildId, name }) {
  return `${applicationId}:${guildId || 'global'}:${name}`;
}

function getCachedSlashCommandId({ name, applicationId, guildId = null } = {}) {
  if (!name || !applicationId) return null;
  const primaryKey = cacheKey({ applicationId, guildId, name });
  const globalKey = cacheKey({ applicationId, guildId: null, name });
  return CACHE.get(primaryKey) || CACHE.get(globalKey) || null;
}

function resolveSlashMentionPlaceholders(text, { applicationId, guildId = null } = {}) {
  if (typeof text !== 'string') return text;
  if (!text.includes('{{COMMAND') && !text.includes('{{command')) return text;
  if (!applicationId) return text;

  if (!USE_SLASH_COMMAND_IDS) {
    // Solo convierte el placeholder a texto del comando: /name o /name sub
    return text.replace(/<\/\s*([^:>]+?)\s*:\s*\{\{\s*(?:COMMAND|command)\s*\}\}\s*>/g, (match, fullNameRaw) => {
      const fullName = String(fullNameRaw || '').trim().replace(/\s+/g, ' ');
      if (!fullName) return match;
      return `/${fullName}`;
    });
  }

  // Matches: </bug:{{COMMAND}}> or </bug:{{command}}> or with subcommand: </music play:{{COMMAND}}>
  return text.replace(/<\/\s*([^:>]+?)\s*:\s*\{\{\s*(?:COMMAND|command)\s*\}\}\s*>/g, (match, fullNameRaw) => {
    const fullName = String(fullNameRaw || '').trim().replace(/\s+/g, ' ');
    if (!fullName) return match;
    const rootName = fullName.split(' ')[0];
    const id = getCachedSlashCommandId({ name: rootName, applicationId, guildId });
    if (!id) return `/${fullName}`;
    return `</${fullName}:${id}>`;
  });
}

function cacheCommands({ applicationId, guildId = null, commands }) {
  if (!applicationId || !Array.isArray(commands)) return;
  for (const cmd of commands) {
    if (!cmd || !cmd.name || !cmd.id) continue;
    CACHE.set(cacheKey({ applicationId, guildId, name: String(cmd.name) }), String(cmd.id));
  }
}

async function fetchIdsFromDiscord({ applicationId, token, guildId = null } = {}) {
  if (!applicationId || !token) return [];
  const rest = new REST({ version: '10' }).setToken(token);
  if (guildId) {
    return rest.get(Routes.applicationGuildCommands(applicationId, guildId));
  }
  return rest.get(Routes.applicationCommands(applicationId));
}

async function getSlashCommandId({ name, applicationId, guildId = null, allowFetch = true } = {}) {
  if (!USE_SLASH_COMMAND_IDS) return null;
  if (!name || !applicationId) return null;

  const primaryKey = cacheKey({ applicationId, guildId, name });
  const globalKey = cacheKey({ applicationId, guildId: null, name });

  if (CACHE.has(primaryKey)) return CACHE.get(primaryKey);
  if (CACHE.has(globalKey)) return CACHE.get(globalKey);

  // Fetch from Discord API (no DB sync; only in-memory cache)
  if (allowFetch) {
    const token = process.env.TOKEN;
    if (token) {
      try {
        const list = await fetchIdsFromDiscord({ applicationId, token, guildId });
        if (Array.isArray(list) && list.length) {
          cacheCommands({ applicationId, guildId, commands: list });
          const found = list.find((c) => c && c.name === name);
          if (found?.id) return String(found.id);
        }
      } catch (e) {
        logger?.warn?.('[slashIds] fetch failed', e?.message || e);
      }

      // Try global if guild fetch didn't find it
      if (guildId) {
        try {
          const list = await fetchIdsFromDiscord({ applicationId, token, guildId: null });
          if (Array.isArray(list) && list.length) {
            cacheCommands({ applicationId, guildId: null, commands: list });
            const found = list.find((c) => c && c.name === name);
            if (found?.id) return String(found.id);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return null;
}

async function slashMention({ name, subcommand = null, applicationId, guildId = null } = {}) {
  const fullName = subcommand ? `${name} ${subcommand}` : name;
  if (!USE_SLASH_COMMAND_IDS) return `/${fullName}`;

  const id = await getSlashCommandId({ name, applicationId, guildId });
  if (!id) return `/${fullName}`;
  return `</${fullName}:${id}>`;
}

module.exports = {
  isUsingSlashCommandIds,
  getSlashCommandId,
  slashMention,
  getCachedSlashCommandId,
  resolveSlashMentionPlaceholders,
};
