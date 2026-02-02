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

function toKeyToken(s) {
    return String(s || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

function pickLocalizedValue({ key, botLocale, defaultJson, enJson }) {
    const json = getCommandsJson(botLocale);
    if (typeof json?.[key] === 'string' && json[key].trim()) return json[key];
    if (typeof defaultJson?.[key] === 'string' && defaultJson[key].trim()) return defaultJson[key];
    if (typeof enJson?.[key] === 'string' && enJson[key].trim()) return enJson[key];
    return null;
}

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
        if (discordLocale) {
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

function getDescKeyForOptionPath(commandName, optionPathParts) {
    const cmd = toKeyToken(commandName);
    const parts = Array.isArray(optionPathParts) ? optionPathParts : [];
    const tokens = parts.map(toKeyToken).filter(Boolean);
    if (!cmd || !tokens.length) return null;
    // Ej:
    //   /invite canal -> OPT_INVITE_CANAL_DESC
    //   /auction bid cantidad -> OPT_AUCTION_BID_CANTIDAD_DESC
    return `OPT_${cmd}_${tokens.join('_')}_DESC`;
}

function getSlashOptionDescription(commandName, optionPathParts, { defaultLocale = 'en-US' } = {}) {
    const primaryKey = getDescKeyForOptionPath(commandName, optionPathParts);
    const last = Array.isArray(optionPathParts) && optionPathParts.length ? optionPathParts[optionPathParts.length - 1] : null;
    const fallbackKey = last ? `OPT_${toKeyToken(last)}_DESC` : null;
    const keys = [primaryKey, fallbackKey].filter(Boolean);
    if (!keys.length) return { description: null, localizations: {}, key: null };

    const botLocales = getBotLocales();
    const en = getCommandsJson('en-US');
    const defaultJson = getCommandsJson(defaultLocale);

    const localizations = {};
    for (const botLocale of botLocales) {
        const discordLocale = toDiscordLocale(botLocale);
        if (!discordLocale) continue;

        let value = null;
        for (const key of keys) {
            value = pickLocalizedValue({ key, botLocale, defaultJson, enJson: en });
            if (typeof value === 'string' && value.trim()) break;
        }
        if (typeof value === 'string' && value.trim()) {
            // Discord: option descriptions max 100 chars.
            localizations[discordLocale] = value.trim().slice(0, 100);
        }
    }

    let primaryRaw = null;
    for (const key of keys) {
        if (typeof en?.[key] === 'string' && en[key].trim()) { primaryRaw = en[key]; break; }
        if (typeof defaultJson?.[key] === 'string' && defaultJson[key].trim()) { primaryRaw = defaultJson[key]; break; }
    }

    if (!primaryRaw) {
        primaryRaw = (typeof localizations['en-US'] === 'string' ? localizations['en-US'] : null) ||
            (typeof localizations['es-ES'] === 'string' ? localizations['es-ES'] : null) ||
            null;
    }

    const primary = (typeof primaryRaw === 'string' && primaryRaw.trim())
        ? primaryRaw.trim().slice(0, 100)
        : null;

    if (primary && !localizations['en-US']) {
        localizations['en-US'] = primary;
    }

    return { description: primary, localizations, key: primaryKey || fallbackKey };
}

function applySlashI18nToCommandJson(commandJson, { defaultLocale = 'en-US' } = {}) {
    if (!commandJson || typeof commandJson !== 'object') return commandJson;
    const commandName = String(commandJson.name || '').trim();
    if (!commandName) return commandJson;

    // 1) Command description
    if (!commandJson.description_localizations || Object.keys(commandJson.description_localizations).length === 0) {
        const desc = getSlashCommandDescription(commandName, { defaultLocale });
        if (desc && desc.localizations && Object.keys(desc.localizations).length) {
            commandJson.description_localizations = desc.localizations;
        }
        if (desc && typeof desc.description === 'string' && desc.description.trim()) {
            commandJson.description = desc.description.trim().slice(0, 100);
        }
    }

    // 2) Options (recursive)
    function walkOptions(options, pathParts) {
        if (!Array.isArray(options)) return;
        for (const opt of options) {
            if (!opt || typeof opt !== 'object') continue;
            const name = String(opt.name || '').trim();
            if (!name) continue;

            const nextPath = [...pathParts, name];

            // Only apply when it doesn't already exist.
            if (!opt.description_localizations || Object.keys(opt.description_localizations).length === 0) {
                const od = getSlashOptionDescription(commandName, nextPath, { defaultLocale });
                if (od && od.localizations && Object.keys(od.localizations).length) {
                    opt.description_localizations = od.localizations;
                }
                if (od && typeof od.description === 'string' && od.description.trim()) {
                    opt.description = od.description.trim().slice(0, 100);
                }
            }

            if (Array.isArray(opt.options) && opt.options.length) {
                walkOptions(opt.options, nextPath);
            }
        }
    }

    walkOptions(commandJson.options, []);
    return commandJson;
}

module.exports = {
    getSlashCommandDescription,
    getSlashOptionDescription,
    applySlashI18nToCommandJson,
};
