const { ensureMongoConnection, mongoose } = require('../Util/mongoConnect');
const GuildSchema = require('./GuildSchema');
const Welcome = require('./WelcomeSchema');
const Clvls = require('./ClvlsSchema');
const { getAuditSettings, setAuditChannel, setAuditEnabled } = require('./AuditSchema');

let LanguagesModel;
try {
  LanguagesModel = require('./LanguageSchema');
} catch (_) {
  LanguagesModel = null;
}

const collectionName = 'prefixes';

async function setGuildPrefix(guildId, prefix) {
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { Prefix: [prefix] },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const options = { upsert: true };
  const result = await db.collection(collectionName).updateOne(query, update, options);
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function setGuildLanguage(guildId, lang, ownerId) {
  const langCode = String(lang).trim();
  if (LanguagesModel && typeof LanguagesModel.updateOne === 'function') {
    try {
      let useMongoose = false;
      try {
        useMongoose = mongoose.connection && mongoose.connection.readyState === 1;
      } catch (_) {
        useMongoose = false;
      }

      if (useMongoose) {
        const res = await LanguagesModel.updateOne(
          { guildID: guildId },
          { $set: { language: langCode }, $setOnInsert: { guildID: guildId } },
          { upsert: true }
        );
        // seguimos abajo para también sincronizar GuildSchema/guilds
      }
    } catch (err) {
      // fall back to the helper-backed path below if Mongoose fails.
    }
  }

  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const update = {
    $set: { language: langCode },
    $setOnInsert: { guildID: guildId, id: guildId },
  };
  const options = { upsert: true };
  const result = await db.collection('languages').updateOne(query, update, options);

  // Mantener compatibilidad: el bot también guarda/lee el idioma desde `guilds.Language`.
  // Si esto no se actualiza, el idioma se queda pegado al default (es-ES) aunque exista `languages`.
  try {
    const guildQuery = { guildID: guildId };
    const guildUpdate = {
      $set: { Language: langCode },
      $setOnInsert: { guildID: guildId, ownerID: ownerId ?? null },
    };
    await db.collection('guilds').updateOne(guildQuery, guildUpdate, { upsert: true });
  } catch (_) {
    // ignore
  }

  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function getGuildSettings(guildId) {
  const connection = await ensureMongoConnection();
  const db = connection.db;
  const query = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
  const doc = await db.collection(collectionName).findOne(query);
  const settings = doc || {};

  try {
    const serverDoc = await GuildSchema.findOne({ guildID: guildId }).lean();
    if (serverDoc) {
      if (serverDoc.Language) {
        settings.Language = serverDoc.Language;
        settings.language = serverDoc.Language;
      }
      if (serverDoc.Welcome) settings.Welcome = serverDoc.Welcome;
      if (serverDoc.Byes) settings.Byes = serverDoc.Byes;
      if (serverDoc.Rank) settings.Rank = serverDoc.Rank;
    }
  } catch (err) {
    // ignore: podemos seguir usando MongoClient
  }

  // Fuente de verdad para el idioma (lo escribe el comando de idioma): colección `languages`.
  // Se consulta SIEMPRE para que no se quede el default de `guilds.Language`.
  try {
    const queryLang = { $or: [{ guildID: guildId }, { guildId: guildId }, { id: guildId }] };
    const langDoc = await db.collection('languages').findOne(queryLang);
    if (langDoc && langDoc.language) {
      settings.Language = langDoc.language;
      settings.language = langDoc.language;
    }
  } catch (_) {
    // ignore
  }

  try {
    if ((!settings.Language || settings.Language === '') && LanguagesModel && typeof LanguagesModel.findOne === 'function') {
      const langDoc = await LanguagesModel.findOne({ guildID: guildId }).lean();
      if (langDoc && langDoc.language) {
        settings.Language = langDoc.language;
        settings.language = langDoc.language;
      }
    }
  } catch (_) {
    // ignore
  }

  try {
    const welcomeDoc = await Welcome.findOne({ guildID: guildId, type: 'config' }).lean();
    if (welcomeDoc) {
      settings.WelcomeConfig = {
        enabled: welcomeDoc.enabled,
        channelID: welcomeDoc.channelID,
        message: welcomeDoc.message,
        embed: welcomeDoc.embed,
        updatedAt: welcomeDoc.updatedAt,
      };
    }
  } catch (_) { }

  try {
    const clvlsDoc = await Clvls.findOne({ guildID: guildId }).lean();
    if (clvlsDoc) {
      settings.LevelsConfig = clvlsDoc;
    }
  } catch (_) { }

  try {
    const clvlsDoc = await Clvls.findOne({ guildID: guildId }).lean();
    if (clvlsDoc) {
      settings.LevelsConfig = clvlsDoc;
    }
  } catch (_) { }

  try {
    const auditDoc = await getAuditSettings(guildId);
    if (auditDoc) {
      if (auditDoc.channelId !== undefined) {
        settings.AuditChannelId = auditDoc.channelId ?? settings.AuditChannelId ?? null;
      }
      if (auditDoc.enabled !== undefined) {
        settings.AuditEnabled = typeof auditDoc.enabled === 'boolean' ? auditDoc.enabled : settings.AuditEnabled ?? null;
      }
    }
  } catch (_) {
    // ignore
  }

  return settings;
}

async function setGuildAuditChannel(guildId, channelId) {
  return setAuditChannel(guildId, channelId);
}

async function setGuildAuditEnabled(guildId, enabled) {
  return setAuditEnabled(guildId, enabled);
}

module.exports = {
  setGuildLanguage,
  getGuildSettings,
  setGuildPrefix,
  setGuildAuditChannel,
  setGuildAuditEnabled,
};
