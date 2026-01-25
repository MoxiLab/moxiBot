const fs = require('fs');
const path = require('path');

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

const COMMAND_DESC_KEY_OVERRIDES = {
    // Si en algún momento hay comandos donde el nombre no coincide con el key, mapear aquí.
    // Ejemplo histórico: shop -> CMD_MOXISHOP_DESC (pero en slash el comando se llama 'moxishop').
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

    // Fallback: carpetas dentro de Languages/
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

const __commandsJsonCache = new Map();
function getCommandsJson(botLocale) {
    const key = String(botLocale || '').trim();
    if (!key) return {};
    if (__commandsJsonCache.has(key)) return __commandsJsonCache.get(key);

    const filePath = path.join(__dirname, '..', 'Languages', key, 'commands.json');
    const json = readJsonSafe(filePath) || {};
    __commandsJsonCache.set(key, json);
    return json;
}

function toDiscordLocale(botLocale) {
    const raw = String(botLocale || '').trim();
    if (!raw) return null;
    const mapped = BOT_TO_DISCORD_LOCALE[raw] || raw;
    return SUPPORTED_DISCORD_LOCALES.has(mapped) ? mapped : null;
}

function getDescKeyForCommand(commandName) {
    const safe = String(commandName || '').trim();
    if (!safe) return null;
    const override = COMMAND_DESC_KEY_OVERRIDES[safe];
    if (override) return override;
    return `CMD_${safe.toUpperCase()}_DESC`;
}

function getSlashCommandDescription(commandName, { defaultLocale = 'en-US' } = {}) {
    const key = getDescKeyForCommand(commandName);
    if (!key) {
        return { description: 'Command', localizations: {} };
    }

    const botLocales = getBotLocales();
    const en = getCommandsJson('en-US');
    const defaultJson = getCommandsJson(defaultLocale);

    const localizations = {};
    for (const botLocale of botLocales) {
        const discordLocale = toDiscordLocale(botLocale);
        if(discordLocale) {
            const json = getCommandsJson(botLocale);
            const value = typeof json?.[key] === 'string'
                ? json[key]
                : (typeof defaultJson?.[key] === 'string'
                    ? defaultJson[key]
                    : (typeof en?.[key] === 'string' ? en[key] : null));

            if (typeof value === 'string' && value.trim()) {
                localizations[discordLocale] = value;
            }
        }
    }

    // Preferimos en-US como description principal.
    const primary =
        (typeof en?.[key] === 'string' && en[key].trim())
            ? en[key]
            : (typeof defaultJson?.[key] === 'string' && defaultJson[key].trim())
                ? defaultJson[key]
                : (typeof localizations['en-US'] === 'string' ? localizations['en-US'] : null) ||
                (typeof localizations['es-ES'] === 'string' ? localizations['es-ES'] : null) ||
                'Command';

    // Asegurar que el mapa contenga el mismo en-US si lo tenemos.
    if (typeof primary === 'string' && primary.trim() && !localizations['en-US']) {
        localizations['en-US'] = primary;
    }

    return { description: primary, localizations, key };
}

module.exports = {
    getSlashCommandDescription,
};
