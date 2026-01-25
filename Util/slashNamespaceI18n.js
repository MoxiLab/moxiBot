const fs = require('fs');
const path = require('path');

// Builds static Discord localizations for arbitrary JSON keys under Languages/<locale>/<namespace>.json.
// Example: ns='economy/auction', key='SLASH_HELP_DESC'

const SUPPORTED_DISCORD_LOCALES = new Set([
    'en-US',
    'es-ES',
    'pt-BR',
    'zh-CN',
    'de',
    'fr',
    'it',
    'ja',
    'ko',
    'pl',
    'ru',
    'tr',
    'uk',
    'id',
    'hi',
]);

const BOT_TO_DISCORD_LOCALE = {
    'de-DE': 'de',
    'fr-FR': 'fr',
    'it-IT': 'it',
    'ja-JP': 'ja',
    'ko-KR': 'ko',
    'pl-PL': 'pl',
    'ru-RU': 'ru',
    'tr-TR': 'tr',
    'uk-UA': 'uk',
    'id-ID': 'id',
    'hi-IN': 'hi',
    // NOTE: ar-SA no está soportado por Discord para localizations de slash.
};

function stripBom(s) {
    if (typeof s !== 'string') return s;
    return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function readJsonSafe(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const raw = stripBom(fs.readFileSync(filePath, 'utf8'));
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

let __languageMetaCache = null;
function getBotLocales() {
    if (__languageMetaCache) return __languageMetaCache;

    const metaPath = path.join(__dirname, '..', 'Languages', 'language-meta.json');
    const meta = readJsonSafe(metaPath);
    if (Array.isArray(meta) && meta.length) {
        __languageMetaCache = meta
            .map((x) => String(x?.name || '').trim())
            .filter(Boolean);
        return __languageMetaCache;
    }

    try {
        const languagesDir = path.join(__dirname, '..', 'Languages');
        const dirs = fs
            .readdirSync(languagesDir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name);
        __languageMetaCache = dirs;
        return __languageMetaCache;
    } catch {
        __languageMetaCache = ['en-US', 'es-ES'];
        return __languageMetaCache;
    }
}

function toDiscordLocale(botLocale) {
    const raw = String(botLocale || '').trim();
    if (!raw) return null;
    const mapped = BOT_TO_DISCORD_LOCALE[raw] || raw;
    return SUPPORTED_DISCORD_LOCALES.has(mapped) ? mapped : null;
}

const __nsCache = new Map();
function getNamespaceJson(botLocale, ns) {
    const locale = String(botLocale || '').trim();
    const namespace = String(ns || '').trim();
    if (!locale || !namespace) return {};

    const cacheKey = `${locale}|${namespace}`;
    if (__nsCache.has(cacheKey)) return __nsCache.get(cacheKey);

    const filePath = path.join(__dirname, '..', 'Languages', locale, `${namespace}.json`);
    const json = readJsonSafe(filePath) || {};
    __nsCache.set(cacheKey, json);
    return json;
}

function pickValue({ json, key, defaultJson, enJson }) {
    const v = (typeof json?.[key] === 'string') ? json[key] : null;
    if (v && v.trim()) return v;

    const d = (typeof defaultJson?.[key] === 'string') ? defaultJson[key] : null;
    if (d && d.trim()) return d;

    const e = (typeof enJson?.[key] === 'string') ? enJson[key] : null;
    if (e && e.trim()) return e;

    return null;
}

function getSlashNamespaceString(ns, key, { defaultLocale = 'en-US' } = {}) {
    const namespace = String(ns || '').trim();
    const k = String(key || '').trim();

    if (!namespace || !k) {
        return { description: 'Command', localizations: {} };
    }

    const botLocales = getBotLocales();
    const en = getNamespaceJson('en-US', namespace);
    const defaultJson = getNamespaceJson(defaultLocale, namespace);

    const localizations = {};
    for (const botLocale of botLocales) {
        const discordLocale = toDiscordLocale(botLocale);
        if(discordLocale) {
            const json = getNamespaceJson(botLocale, namespace);
            const value = pickValue({ json, key: k, defaultJson, enJson: en });
            if (typeof value === 'string' && value.trim()) {
                localizations[discordLocale] = value;
            }
        }
    }

    const primary =
        (typeof en?.[k] === 'string' && en[k].trim())
            ? en[k]
            : (typeof defaultJson?.[k] === 'string' && defaultJson[k].trim())
                ? defaultJson[k]
                : (typeof localizations['en-US'] === 'string' ? localizations['en-US'] : null) ||
                (typeof localizations['es-ES'] === 'string' ? localizations['es-ES'] : null) ||
                'Command';

    if (typeof primary === 'string' && primary.trim() && !localizations['en-US']) {
        localizations['en-US'] = primary;
    }

    return { description: primary, localizations };
}

module.exports = {
    getSlashNamespaceString,
};
