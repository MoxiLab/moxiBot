const { REST, Routes } = require('discord.js');
const logger = require('./logger');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

function normalizeCommandName(value) {
  return normalizeDbText(value, { maxLen: 100, fallback: '' });
}

function isPersistingSlashCommandIds() {
  const env = process.env.SLASH_COMMAND_IDS_PERSIST;
  if (env === 'true') return true;
  if (env === 'false') return false;

  try {
    // eslint-disable-next-line global-require
    const Config = require('../Config');
    if (typeof Config?.Bot?.PersistSlashCommandIds === 'boolean') return Config.Bot.PersistSlashCommandIds;
  } catch {
    // ignore
  }

  return false;
}

const PERSIST_SLASH_IDS = isPersistingSlashCommandIds();

let SlashCommandIdModel = null;
async function getSlashCommandIdModel() {
  if (!PERSIST_SLASH_IDS) return null;
  try {
    if (!SlashCommandIdModel) {
      // eslint-disable-next-line global-require
      SlashCommandIdModel = require('../Models/SlashCommandIdSchema');
    }
    return SlashCommandIdModel;
  } catch {
    return null;
  }
}

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
  const appId = normalizeDiscordId(applicationId);
  const gid = normalizeDiscordId(guildId) || null;
  const commandName = normalizeCommandName(name);
  if (!appId || !commandName) return '';
  return `${appId}:${gid || 'global'}:${commandName}`;
}

function getCachedSlashCommandId({ name, applicationId, guildId = null } = {}) {
  const appId = normalizeDiscordId(applicationId);
  const gid = normalizeDiscordId(guildId) || null;
  const commandName = normalizeCommandName(name);
  if (!commandName || !appId) return null;
  const primaryKey = cacheKey({ applicationId: appId, guildId: gid, name: commandName });
  const globalKey = cacheKey({ applicationId: appId, guildId: null, name: commandName });
  if (!primaryKey || !globalKey) return null;
  return CACHE.get(primaryKey) || CACHE.get(globalKey) || null;
}

function resolveSlashMentionPlaceholders(text, { applicationId, guildId = null } = {}) {
  if (typeof text !== 'string') return text;
  if (!text.includes('{{COMMAND') && !text.includes('{{command')) return text;
  const appId = normalizeDiscordId(applicationId);
  const gid = normalizeDiscordId(guildId) || null;
  if (!appId) return text;

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
    const id = getCachedSlashCommandId({ name: rootName, applicationId: appId, guildId: gid });
    if (!id) return `/${fullName}`;
    return `</${fullName}:${id}>`;
  });
}

function cacheCommands({ applicationId, guildId = null, commands }) {
  const appId = normalizeDiscordId(applicationId);
  const gid = normalizeDiscordId(guildId) || null;
  if (!appId || !Array.isArray(commands)) return;
  for (const cmd of commands) {
    const commandName = normalizeCommandName(cmd?.name);
    const commandId = normalizeDiscordId(cmd?.id);
    const key = cacheKey({ applicationId: appId, guildId: gid, name: commandName });
    if(commandName && commandId && key) {
      CACHE.set(key, commandId);
    }
  }
}

async function loadSlashCommandIdsFromDb({ applicationId, guildId = null } = {}) {
  if (!USE_SLASH_COMMAND_IDS) return 0;
  if (!PERSIST_SLASH_IDS) return 0;
  const appId = normalizeDiscordId(applicationId);
  const gid = normalizeDiscordId(guildId) || null;
  if (!appId) return 0;

  try {
    const Model = await getSlashCommandIdModel();
    if (!Model) return 0;

    const docs = await Model.find({
      applicationId: appId,
      guildId: gid,
    }).lean().exec();

    if (Array.isArray(docs)) {
      for (const d of docs) {
        if (d?.name && d?.commandId) {
          const commandName = normalizeCommandName(d.name);
          const commandId = normalizeDiscordId(d.commandId);
          if (!commandName || !commandId) continue;
          CACHE.set(cacheKey({
            applicationId: appId,
            guildId: gid,
            name: commandName,
          }), commandId);
        }
      }
      return docs.length;
    }
  } catch (e) {
    logger?.warn?.('[slashIds] db preload failed', e?.message || e);
  }

  return 0;
}

async function warmSlashCommandIdsCache({ applicationId, guildId = null } = {}) {
  if (!USE_SLASH_COMMAND_IDS) return 0;
  const appId = normalizeDiscordId(applicationId);
  const gid = normalizeDiscordId(guildId) || null;
  if (!appId) return 0;

  const token = process.env.TOKEN;
  if (!token) return 0;

  try {
    const list = await fetchIdsFromDiscord({ applicationId: appId, token, guildId: gid });
    if (!Array.isArray(list) || !list.length) return 0;

    cacheCommands({ applicationId: appId, guildId: gid, commands: list });

    if (PERSIST_SLASH_IDS) {
      try {
        const Model = await getSlashCommandIdModel();
        if (Model) {
          const ops = [];
          for (const c of list) {
            if (!c?.name || !c?.id) continue;
            ops.push({
              updateOne: {
                filter: {
                  applicationId: appId,
                  guildId: gid,
                  name: normalizeCommandName(c.name),
                },
                update: {
                  $set: { commandId: normalizeDiscordId(c.id) },
                  $setOnInsert: {
                    applicationId: appId,
                    guildId: gid,
                    name: normalizeCommandName(c.name),
                  },
                },
                upsert: true,
              }
            });
          }
          if (ops.length) {
            await Model.bulkWrite(ops, { ordered: false });
          }
        }
      } catch (e) {
        logger?.warn?.('[slashIds] db warm bulkWrite failed', e?.message || e);
      }
    }

    return list.length;
  } catch (e) {
    logger?.warn?.('[slashIds] warm fetch failed', e?.message || e);
    return 0;
  }
}

async function fetchIdsFromDiscord({ applicationId, token, guildId = null } = {}) {
  const appId = normalizeDiscordId(applicationId);
  const gid = normalizeDiscordId(guildId) || null;
  if (!appId || !token) return [];
  const rest = new REST({ version: '10' }).setToken(token);
  if (gid) {
    return rest.get(Routes.applicationGuildCommands(appId, gid));
  }
  return rest.get(Routes.applicationCommands(appId));
}

async function getSlashCommandId({ name, applicationId, guildId = null, allowFetch = true } = {}) {
  if (!USE_SLASH_COMMAND_IDS) return null;
  const commandName = normalizeCommandName(name);
  const appId = normalizeDiscordId(applicationId);
  const gid = normalizeDiscordId(guildId) || null;
  if (!commandName || !appId) return null;

  const primaryKey = cacheKey({ applicationId: appId, guildId: gid, name: commandName });
  const globalKey = cacheKey({ applicationId: appId, guildId: null, name: commandName });
  if (!primaryKey || !globalKey) return null;

  if (CACHE.has(primaryKey)) return CACHE.get(primaryKey);
  if (CACHE.has(globalKey)) return CACHE.get(globalKey);

  // DB lookup (opcional) para cache persistente
  if (PERSIST_SLASH_IDS) {
    try {
      const Model = await getSlashCommandIdModel();
      if (Model) {
        const doc = await Model.findOne({
          applicationId: appId,
          guildId: gid,
          name: commandName,
        }).lean().exec();

        if (doc?.commandId) {
          const id = String(doc.commandId);
          CACHE.set(primaryKey, id);
          return id;
        }
      }
    } catch (e) {
      logger?.warn?.('[slashIds] db lookup failed', e?.message || e);
    }
  }

  // Fetch from Discord API
  if (allowFetch) {
    const token = process.env.TOKEN;
    if (token) {
      try {
        const list = await fetchIdsFromDiscord({ applicationId: appId, token, guildId: gid });
        if (Array.isArray(list) && list.length) {
          cacheCommands({ applicationId: appId, guildId: gid, commands: list });
          const found = list.find((c) => c && normalizeCommandName(c.name) === commandName);
          if (found?.id) {
            const id = normalizeDiscordId(found.id);
            if (!id) return null;

            if (PERSIST_SLASH_IDS) {
              try {
                const Model = await getSlashCommandIdModel();
                if (Model) {
                  await Model.updateOne(
                    {
                      applicationId: appId,
                      guildId: gid,
                      name: commandName,
                    },
                    {
                      $set: { commandId: id },
                      $setOnInsert: { applicationId: appId, guildId: gid, name: commandName },
                    },
                    { upsert: true }
                  ).exec();
                }
              } catch (e) {
                logger?.warn?.('[slashIds] db upsert failed', e?.message || e);
              }
            }

            return id;
          }
        }
      } catch (e) {
        logger?.warn?.('[slashIds] fetch failed', e?.message || e);
      }

      // Try global if guild fetch didn't find it
      if (gid) {
        try {
          const list = await fetchIdsFromDiscord({ applicationId: appId, token, guildId: null });
          if (Array.isArray(list) && list.length) {
            cacheCommands({ applicationId: appId, guildId: null, commands: list });
            const found = list.find((c) => c && normalizeCommandName(c.name) === commandName);
            if (found?.id) {
              const id = normalizeDiscordId(found.id);
              if (!id) return null;

              if (PERSIST_SLASH_IDS) {
                try {
                  const Model = await getSlashCommandIdModel();
                  if (Model) {
                    await Model.updateOne(
                      {
                        applicationId: appId,
                        guildId: null,
                        name: commandName,
                      },
                      {
                        $set: { commandId: id },
                        $setOnInsert: { applicationId: appId, guildId: null, name: commandName },
                      },
                      { upsert: true }
                    ).exec();
                  }
                } catch {
                  // ignore
                }
              }

              return id;
            }
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
  const baseName = normalizeCommandName(name);
  const subName = subcommand ? normalizeCommandName(subcommand) : '';
  const fullName = subName ? `${baseName} ${subName}` : baseName;
  if (!fullName) return '/';
  if (!USE_SLASH_COMMAND_IDS) return `/${fullName}`;

  const id = await getSlashCommandId({ name: baseName, applicationId, guildId });
  if (!id) return `/${fullName}`;
  return `</${fullName}:${id}>`;
}

module.exports = {
  isUsingSlashCommandIds,
  getSlashCommandId,
  slashMention,
  getCachedSlashCommandId,
  resolveSlashMentionPlaceholders,
  warmSlashCommandIdsCache,
  loadSlashCommandIdsFromDb,
};
