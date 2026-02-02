const { ensureMongoConnection } = require('./mongoConnect');

const COLLECTION = 'ai_channels';

const CACHE_TTL_MS = Number(process.env.AI_CHANNEL_CACHE_TTL_MS || '') || 30_000;
const cache = new Map(); // key -> { doc, expiresAt }
let indexesEnsured = false;

function boolFromEnv(name, defaultValue) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === '') return !!defaultValue;
    const s = String(raw).trim().toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on') return true;
    if (s === '0' || s === 'false' || s === 'no' || s === 'n' || s === 'off') return false;
    return !!defaultValue;
}

function toTrimmedString(value) {
    return (value === undefined || value === null) ? '' : String(value).trim();
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

function clampNumber(value, min, max) {
    const n = toNumber(value);
    if (!Number.isFinite(n)) return NaN;
    return Math.min(max, Math.max(min, n));
}

function clampInt(value, min, max) {
    const n = Math.trunc(toNumber(value));
    if (!Number.isFinite(n)) return NaN;
    return Math.min(max, Math.max(min, n));
}

function getDefaultConfig() {
    const creatorId = toTrimmedString(process.env.AI_CREATOR_USER_ID);
    const creatorName = toTrimmedString(process.env.AI_CREATOR_NAME) || 'Naiara';
    // Importante: no exponer IDs/mentions por defecto en mensajes públicos.
    const creatorLabel = creatorName ? `Creadora dev: ${creatorName}` : '';
    const envPrompt = toTrimmedString(process.env.AI_DEFAULT_SYSTEM_PROMPT);
    const defaultPrompt = envPrompt || [
        'Eres Moxi, una asistente útil del bot/servidor (NO eres “ChatGPT”).',
        'No te presentes como “fui creada por OpenAI”. Este bot fue desarrollado por su creadora dev.',
        creatorLabel,
        'Si te preguntan quién te creó o quién te desarrolló: responde que tu creadora dev es la indicada arriba. No reveles IDs de usuarios, ni menciones, ni datos privados.',
        'Puedes añadir que usas modelos de IA de OpenAI, pero no atribuyas la creación del bot a OpenAI.',
        'Responde con mensajes claros y cortos.',
        'Si te piden crear un archivo (por ejemplo ".ts"), devuelve el contenido completo del archivo en un bloque de código Markdown y sugiere el nombre/ruta; asume que la persona lo copiará al proyecto.',
        'Cuando falten detalles, pregunta 1-2 cosas y ofrece una primera versión razonable.',
    ].filter(Boolean).join('\n');

    return {
        ownersOnly: boolFromEnv('AI_OWNERS_ONLY', true),
        // Ejecutar comandos prefix sin prefijo en canales IA (solo owners por defecto)
        commandsWithoutPrefix: boolFromEnv('AI_COMMANDS_WITHOUT_PREFIX', true),
        commandsAllowNonOwners: boolFromEnv('AI_COMMANDS_ALLOW_NON_OWNERS', false),
        // Si un no-owner dispara un comando de moderación, exigir permisos Discord adecuados.
        commandsRequireDiscordPerms: boolFromEnv('AI_COMMANDS_REQUIRE_DISCORD_PERMS', true),
        cooldownMs: clampInt(process.env.AI_COOLDOWN_MS ?? 5000, 250, 10 * 60 * 1000),
        historyLimit: clampInt(process.env.AI_HISTORY_LIMIT ?? 12, 1, 50),
        minChars: clampInt(process.env.AI_MIN_CHARS ?? 2, 1, 2000),
        maxInputChars: clampInt(process.env.AI_MAX_INPUT_CHARS ?? 8000, 500, 100000),
        model: toTrimmedString(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
        temperature: clampNumber(process.env.OPENAI_TEMPERATURE ?? 0.7, 0, 2),
        systemPrompt: defaultPrompt,
    };
}

function mergeConfig(doc) {
    const d = doc || {};
    const defaults = getDefaultConfig();
    return {
        enabled: !!d.enabled,
        ownersOnly: (typeof d.ownersOnly === 'boolean') ? d.ownersOnly : defaults.ownersOnly,
        commandsWithoutPrefix: (typeof d.commandsWithoutPrefix === 'boolean') ? d.commandsWithoutPrefix : defaults.commandsWithoutPrefix,
        commandsAllowNonOwners: (typeof d.commandsAllowNonOwners === 'boolean') ? d.commandsAllowNonOwners : defaults.commandsAllowNonOwners,
        commandsRequireDiscordPerms: (typeof d.commandsRequireDiscordPerms === 'boolean') ? d.commandsRequireDiscordPerms : defaults.commandsRequireDiscordPerms,
        cooldownMs: Number.isFinite(Number(d.cooldownMs)) ? clampInt(d.cooldownMs, 250, 10 * 60 * 1000) : defaults.cooldownMs,
        historyLimit: Number.isFinite(Number(d.historyLimit)) ? clampInt(d.historyLimit, 1, 50) : defaults.historyLimit,
        minChars: Number.isFinite(Number(d.minChars)) ? clampInt(d.minChars, 1, 2000) : defaults.minChars,
        maxInputChars: Number.isFinite(Number(d.maxInputChars)) ? clampInt(d.maxInputChars, 500, 100000) : defaults.maxInputChars,
        model: toTrimmedString(d.model) || defaults.model,
        temperature: Number.isFinite(Number(d.temperature)) ? clampNumber(d.temperature, 0, 2) : defaults.temperature,
        systemPrompt: toTrimmedString(d.systemPrompt) || defaults.systemPrompt,
    };
}

function cacheKey(guildId, channelId) {
    return `${String(guildId || '')}:${String(channelId || '')}`;
}

async function ensureIndexes() {
    if (indexesEnsured) return;
    indexesEnsured = true;
    try {
        const conn = await ensureMongoConnection();
        const db = conn.db;
        await db.collection(COLLECTION).createIndex({ guildId: 1, channelId: 1 }, { unique: true });
        await db.collection(COLLECTION).createIndex({ guildId: 1, enabled: 1 });
    } catch {
        // best-effort
    }
}

async function getAiConfig(guildId, channelId) {
    const gid = String(guildId || '').trim();
    const cid = String(channelId || '').trim();
    if (!gid || !cid) return { ok: false, reason: 'missing-ids' };

    const key = cacheKey(gid, cid);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
        return { ok: true, config: mergeConfig(cached.doc) };
    }

    try {
        await ensureIndexes();
        const conn = await ensureMongoConnection();
        const db = conn.db;
        const doc = await db.collection(COLLECTION).findOne({ guildId: gid, channelId: cid });
        cache.set(key, { doc: doc || null, expiresAt: now + CACHE_TTL_MS });
        return { ok: true, config: mergeConfig(doc) };
    } catch {
        // Si no hay DB, caer a defaults y deshabilitado (no queremos IA sin control)
        cache.set(key, { doc: null, expiresAt: now + CACHE_TTL_MS });
        return { ok: true, config: mergeConfig({ enabled: false }) };
    }
}

async function updateAiConfig(guildId, channelId, patch = {}, meta = {}) {
    const gid = String(guildId || '').trim();
    const cid = String(channelId || '').trim();
    if (!gid || !cid) return { ok: false, reason: 'missing-ids' };

    await ensureIndexes();
    const conn = await ensureMongoConnection();
    const db = conn.db;

    const $set = {
        guildId: gid,
        channelId: cid,
        updatedAt: new Date(),
    };
    const $unset = {};

    if (meta?.userId) $set.updatedBy = String(meta.userId);

    if (patch.enabled !== undefined) $set.enabled = !!patch.enabled;
    if (patch.ownersOnly !== undefined) $set.ownersOnly = !!patch.ownersOnly;
    if (patch.commandsWithoutPrefix !== undefined) $set.commandsWithoutPrefix = !!patch.commandsWithoutPrefix;
    if (patch.commandsAllowNonOwners !== undefined) $set.commandsAllowNonOwners = !!patch.commandsAllowNonOwners;
    if (patch.commandsRequireDiscordPerms !== undefined) $set.commandsRequireDiscordPerms = !!patch.commandsRequireDiscordPerms;

    if (patch.systemPrompt !== undefined) {
        const p = toTrimmedString(patch.systemPrompt);
        if (!p) $unset.systemPrompt = '';
        else $set.systemPrompt = p.slice(0, 4000);
    }

    if (patch.model !== undefined) {
        const m = toTrimmedString(patch.model);
        if (!m) $unset.model = '';
        else $set.model = m.slice(0, 100);
    }

    if (patch.temperature !== undefined) {
        if (patch.temperature === null || patch.temperature === '') {
            $unset.temperature = '';
        } else {
            const t = clampNumber(patch.temperature, 0, 2);
            if (Number.isFinite(t)) $set.temperature = t;
        }
    }

    if (patch.cooldownMs !== undefined) {
        if (patch.cooldownMs === null || patch.cooldownMs === '') {
            $unset.cooldownMs = '';
        } else {
            const v = clampInt(patch.cooldownMs, 250, 10 * 60 * 1000);
            if (Number.isFinite(v)) $set.cooldownMs = v;
        }
    }

    if (patch.historyLimit !== undefined) {
        if (patch.historyLimit === null || patch.historyLimit === '') {
            $unset.historyLimit = '';
        } else {
            const v = clampInt(patch.historyLimit, 1, 50);
            if (Number.isFinite(v)) $set.historyLimit = v;
        }
    }

    if (patch.minChars !== undefined) {
        if (patch.minChars === null || patch.minChars === '') {
            $unset.minChars = '';
        } else {
            const v = clampInt(patch.minChars, 1, 2000);
            if (Number.isFinite(v)) $set.minChars = v;
        }
    }

    if (patch.maxInputChars !== undefined) {
        if (patch.maxInputChars === null || patch.maxInputChars === '') {
            $unset.maxInputChars = '';
        } else {
            const v = clampInt(patch.maxInputChars, 500, 100000);
            if (Number.isFinite(v)) $set.maxInputChars = v;
        }
    }

    await db.collection(COLLECTION).updateOne(
        { guildId: gid, channelId: cid },
        {
            $set,
            ...(Object.keys($unset).length ? { $unset } : {}),
            $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
    );

    cache.delete(cacheKey(gid, cid));
    return getAiConfig(gid, cid);
}

async function isAiEnabled(guildId, channelId) {
    const gid = String(guildId || '').trim();
    const cid = String(channelId || '').trim();
    if (!gid || !cid) return false;

    const res = await getAiConfig(gid, cid);
    if (!res.ok) return false;
    return !!res.config?.enabled;
}

async function setAiEnabled(guildId, channelId, enabled, meta = {}) {
    const gid = String(guildId || '').trim();
    const cid = String(channelId || '').trim();
    if (!gid || !cid) return { ok: false, reason: 'missing-ids' };

    const on = !!enabled;
    const now = new Date();

    await ensureIndexes();
    const conn = await ensureMongoConnection();
    const db = conn.db;

    const $set = {
        guildId: gid,
        channelId: cid,
        enabled: on,
        updatedAt: now,
    };
    if (meta?.userId) $set.updatedBy = String(meta.userId);

    await db.collection(COLLECTION).updateOne(
        { guildId: gid, channelId: cid },
        {
            $set,
            $setOnInsert: { createdAt: now },
        },
        { upsert: true }
    );

    cache.delete(cacheKey(gid, cid));
    return { ok: true, enabled: on };
}

module.exports = {
    isAiEnabled,
    setAiEnabled,
    getAiConfig,
    updateAiConfig,
};
