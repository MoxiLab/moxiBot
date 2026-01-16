
const { log } = require('console');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const path = require('path');

const { EMOJIS, UNICODE_CODEPOINT_TO_KEY } = require('./Util/emojis');
const debug = require('./Util/debug');
const logger = require('./Util/logger');


const fs = require('fs');
let defaultLangs = ['en-US', 'es-ES', 'zh-CN'];
try {
  const metaPath = path.join(__dirname, 'Languages', 'language-meta.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (Array.isArray(meta)) {
      defaultLangs = meta.map(l => l.name);
    }
  }
} catch (e) {
  console.error('Error loading language-meta.json:', e);
}
const defaultNamespaces = ['misc', 'commands', 'moderation', 'permissions', 'time', 'mentionPanel', 'prefix-panels', 'audit', 'utility/feedback', 'utility/bugGuidelines', 'economy/zones'];

function isDevRuntime() {
  const lifecycle = String(process.env.npm_lifecycle_event || '').trim().toLowerCase();
  if (lifecycle === 'dev') return true;
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'development') return true;
  return false;
}

function shouldAutofillI18n() {
  // Se puede forzar con env var.
  if (String(process.env.I18N_AUTOFILL || '').trim() === '1') return true;
  // Por defecto: en desarrollo, sí.
  return isDevRuntime();
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJsonSafe(filePath, obj) {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  } catch (e) {
    logger.warn('[i18n] No se pudo auto-escribir traducción:', filePath, e?.message || e);
  }
}

function hasDeep(obj, dottedKey) {
  if (!obj || typeof obj !== 'object') return false;
  if (!dottedKey) return false;
  const parts = String(dottedKey).split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return false;
    if (!Object.prototype.hasOwnProperty.call(cur, p)) return false;
    cur = cur[p];
  }
  return cur !== undefined;
}

function setDeep(obj, dottedKey, value) {
  const parts = String(dottedKey).split('.').filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const isLast = i === parts.length - 1;
    if (isLast) {
      if (!Object.prototype.hasOwnProperty.call(cur, p)) cur[p] = value;
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(cur, p) || typeof cur[p] !== 'object' || cur[p] === null || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = cur[p];
  }
}

function autofillMissingTranslation(lang, nsKey) {
  if (!shouldAutofillI18n()) return;
  const sLang = String(lang || '').trim();
  const sKey = String(nsKey || '').trim();
  if (!sLang || !sKey.includes(':')) return;

  const idx = sKey.indexOf(':');
  const ns = sKey.slice(0, idx);
  const keyPath = sKey.slice(idx + 1);
  if (!ns || !keyPath) return;

  const filePath = path.join(__dirname, 'Languages', sLang, `${ns}.json`);
  const json = readJsonSafe(filePath) || {};
  if (hasDeep(json, keyPath)) return;

  // Placeholder: por defecto, igual a la key (sin namespace)
  setDeep(json, keyPath, keyPath);
  writeJsonSafe(filePath, json);
}

// Initialize i18next with backend
let __readyResolve;
const ready = new Promise((resolve) => {
  __readyResolve = resolve;
});

i18next
  .use(Backend)
  .init({
    lng: 'en-US',
    fallbackLng: 'en-US',
    preload: defaultLangs,
    ns: defaultNamespaces,
    defaultNS: 'misc',
    load: 'currentOnly', // Only use the exact language code, never fallback to 'en', 'es', 'zh'
    backend: {
      loadPath: path.join(__dirname, 'Languages', '{{lng}}', '{{ns}}.json')
    },
    interpolation: {
      escapeValue: false
    }
  }, (err) => {
    if (err) console.error('i18next init error:', err);
    try { __readyResolve && __readyResolve(); } catch { }
  });

// Fallback extra: si por algún motivo no se llama al callback (casos raros), no bloquees.
setTimeout(() => {
  try { __readyResolve && __readyResolve(); } catch { }
}, 5000);

// Función de traducción global segura
function translate(key, lang, vars = {}) {
  const originalKey = String(key);
  // Permite usar misc:KEY o KEY
  const nsKey = originalKey.includes(':') ? originalKey : `misc:${originalKey}`;
  const options = { lng: lang || 'es-ES', ...vars, emoji: EMOJIS };
  let res = i18next.t(nsKey, options);

  // i18next devuelve el propio `nsKey` cuando falta la traducción.
  if (!res || res === nsKey) {
    res = i18next.t(nsKey, { ...options, lng: 'en-US' });
  }

  let finalValue = (!res || res === nsKey) ? originalKey : res;

  // Log de claves faltantes (siempre, pero con cache para evitar spam)
  {
    const cacheKey = `${options.lng}|${nsKey}`;
    if (!translate.__missingCache) translate.__missingCache = new Set();
    if (finalValue === originalKey && !translate.__missingCache.has(cacheKey)) {
      translate.__missingCache.add(cacheKey);
      logger.warn(`[i18n] Missing translation lang=${options.lng} key=${nsKey}`);

      // Auto-fill: crea/actualiza el JSON del namespace para este idioma.
      autofillMissingTranslation(options.lng, nsKey);
    }
  }

  if (typeof finalValue === 'string') {
    // Normaliza emojis custom del tipo <a:name:id> o <:name:id> a los definidos en EMOJIS.
    finalValue = finalValue.replace(/<a?:([\w]+):\d+>/g, (match, name) => {
      return EMOJIS[name] || match;
    });

    // Normaliza emojis Unicode por codepoint -> clave de EMOJIS (sin hardcodear emojis aquí).
    finalValue = finalValue.replace(/\p{Extended_Pictographic}/gu, (ch) => {
      const code = (ch.codePointAt(0) || 0).toString(16).toUpperCase();
      const k = UNICODE_CODEPOINT_TO_KEY[code];
      return k && EMOJIS[k] ? EMOJIS[k] : ch;
    });

    // Resuelve placeholders de menciones slash tipo </bug:{{COMMAND}}>
    // Nota: es síncrono; usa caché. Si aún no hay IDs, degrada a /bug.
    try {
      const applicationId = process.env.CLIENT_ID;
      const guildId = vars?.guildId || vars?.guild?.id || null;
      // Lazy require para evitar ciclos
      // eslint-disable-next-line global-require
      const { resolveSlashMentionPlaceholders } = require('./Util/slashCommandMentions');
      if (applicationId) {
        finalValue = resolveSlashMentionPlaceholders(finalValue, { applicationId, guildId });
      }
    } catch {
      // ignore
    }
  }

  return finalValue;
}

async function getGuildLanguageCached(guildId, fallbackLang = 'es-ES') {
  const gid = guildId ? String(guildId) : '';
  if (!gid) return fallbackLang;
  try {
    const { getGuildSettingsCached } = require('./Util/guildSettings');
    const settings = await getGuildSettingsCached(gid);
    const lang = settings?.Language ? String(settings.Language) : '';
    return lang || fallbackLang;
  } catch {
    return fallbackLang;
  }
}

async function getGuildPrefixCached(guildId, fallbackPrefix = '.') {
  const gid = guildId ? String(guildId) : '';
  if (!gid) return fallbackPrefix;
  try {
    const { getGuildSettingsCached } = require('./Util/guildSettings');
    const settings = await getGuildSettingsCached(gid);
    const p0 = Array.isArray(settings?.Prefix) ? settings.Prefix[0] : null;
    const prefix = (typeof p0 === 'string') ? p0.trim() : '';
    return prefix || fallbackPrefix;
  } catch {
    return fallbackPrefix;
  }
}

async function translateGuild(guildId, key, vars = {}, fallbackLang = 'es-ES') {
  const lang = await getGuildLanguageCached(guildId, fallbackLang);
  return translate(key, lang, vars);
}


const moxi = {
  i18next,
  translate,
  ready,
  // Alias para que puedas usar moxi.translation(...) o moxi.t(...)
  translation: translate,
  t: translate,

  // Helpers para usar el idioma guardado del servidor
  getGuildLanguageCached,
  getGuildPrefixCached,
  tGuild: translateGuild,
  // Alias con nombres más claros (sin "t")
  guildLang: getGuildLanguageCached,
  guildPrefix: getGuildPrefixCached,
  translationGuild: translateGuild,

  // Debug centralizado (moxi.*)
  debug,
  debugEnabled: (flag) => debug.isFlagEnabled(flag),
  EMOJIS,
};

module.exports = moxi;
