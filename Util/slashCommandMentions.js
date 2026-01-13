const { REST, Routes } = require('discord.js');
const { ensureMongoConnection } = require('./mongoConnect');
const logger = require('./logger');

let SlashCommandIdModel = null; 

// In-memory cache to allow fast lookups and avoid DB roundtrips.
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

async function getModel() {
  if (SlashCommandIdModel) return SlashCommandIdModel;
  // Lazy require to avoid import cycles
  // eslint-disable-next-line global-require
  SlashCommandIdModel = require('../Models/SlashCommandId');
  return SlashCommandIdModel;
}

async function upsertDeployedCommandIds({ applicationId, guildId = null, deployed }) {
  if (!applicationId) throw new Error('upsertDeployedCommandIds: applicationId is required');
  if (!Array.isArray(deployed) || deployed.length === 0) return { upserted: 0 };

  // Update cache immediately
  for (const cmd of deployed) {
    if (!cmd || !cmd.name || !cmd.id) continue;
    CACHE.set(cacheKey({ applicationId, guildId, name: cmd.name }), String(cmd.id));
  }

  if (!process.env.MONGODB) return { upserted: 0 };

  await ensureMongoConnection();
  const Model = await getModel();

  const ops = deployed
    .filter((c) => c && c.name && c.id)
    .map((c) => ({
      updateOne: {
        filter: { applicationId, guildId: guildId || null, name: String(c.name) },
        update: { $set: { commandId: String(c.id) } },
        upsert: true,
      },
    }));

  if (!ops.length) return { upserted: 0 };

  const res = await Model.bulkWrite(ops, { ordered: false });
  const upserted = res?.upsertedCount || 0;
  return { upserted };
}

async function loadIdsFromDb({ applicationId, guildId = null } = {}) {
  if (!process.env.MONGODB) return 0;
  if (!applicationId) return 0;

  await ensureMongoConnection();
  const Model = await getModel();
  const docs = await Model.find({ applicationId, guildId: guildId || null }).lean();
  for (const d of docs) {
    if (!d?.name || !d?.commandId) continue;
    CACHE.set(cacheKey({ applicationId, guildId, name: d.name }), String(d.commandId));
  }
  return docs.length;
}

async function fetchIdsFromDiscord({ applicationId, token, guildId = null } = {}) {
  if (!applicationId || !token) return [];
  const rest = new REST({ version: '10' }).setToken(token);
  if (guildId) {
    return rest.get(Routes.applicationGuildCommands(applicationId, guildId));
  }
  return rest.get(Routes.applicationCommands(applicationId));
}

async function syncSlashCommandIds({ applicationId, guildId = null } = {}) {
  const token = process.env.TOKEN;
  if (!applicationId || !token) return { synced: 0 };
  const list = await fetchIdsFromDiscord({ applicationId, token, guildId });
  const deployed = Array.isArray(list) ? list : [];
  await upsertDeployedCommandIds({ applicationId, guildId, deployed });
  return { synced: deployed.length };
}

async function getSlashCommandId({ name, applicationId, guildId = null, allowFetch = true } = {}) {
  if (!name || !applicationId) return null;

  const primaryKey = cacheKey({ applicationId, guildId, name });
  const globalKey = cacheKey({ applicationId, guildId: null, name });

  if (CACHE.has(primaryKey)) return CACHE.get(primaryKey);
  if (CACHE.has(globalKey)) return CACHE.get(globalKey);

  // Try DB
  if (process.env.MONGODB) {
    try {
      await ensureMongoConnection();
      const Model = await getModel();
      const doc = await Model.findOne({ applicationId, guildId: guildId || null, name }).lean();
      if (doc?.commandId) {
        CACHE.set(primaryKey, String(doc.commandId));
        return String(doc.commandId);
      }
      // Fallback to global
      const docGlobal = await Model.findOne({ applicationId, guildId: null, name }).lean();
      if (docGlobal?.commandId) {
        CACHE.set(globalKey, String(docGlobal.commandId));
        return String(docGlobal.commandId);
      }
    } catch {
      // ignore and continue
    }
  }

  // As a last resort, fetch from Discord API (and persist if possible)
  if (allowFetch) {
    const token = process.env.TOKEN;
    if (token) {
      try {
        const list = await fetchIdsFromDiscord({ applicationId, token, guildId });
        if (Array.isArray(list) && list.length) {
          await upsertDeployedCommandIds({ applicationId, guildId, deployed: list });
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
            await upsertDeployedCommandIds({ applicationId, guildId: null, deployed: list });
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
  const id = await getSlashCommandId({ name, applicationId, guildId });
  const fullName = subcommand ? `${name} ${subcommand}` : name;
  if (!id) return `/${fullName}`;
  return `</${fullName}:${id}>`;
}

module.exports = {
  upsertDeployedCommandIds,
  loadIdsFromDb,
  getSlashCommandId,
  slashMention,
  syncSlashCommandIds,
  getCachedSlashCommandId,
  resolveSlashMentionPlaceholders,
};
