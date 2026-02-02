const logger = require('./logger');
const { EMOJIS } = require('./emojis');
const { ensureMongoConnection } = require('./mongoConnect');
const CommandRegistry = require('../Models/CommandRegistrySchema');
const moxi = require('../i18n');
const { applySlashI18nToCommandJson } = require('./slashHelpI18n');

function normalizeString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function getRegistryLang() {
    const raw = process.env.COMMAND_REGISTRY_LANG || process.env.DEFAULT_LANG || process.env.LANG;
    const lang = (typeof raw === 'string' && raw.trim()) ? raw.trim() : 'es-ES';
    return lang;
}

function safeCallMaybeFn(value, lang) {
    try {
        if (typeof value === 'function') return value(lang);
        return value;
    } catch {
        return '';
    }
}

function safeGetDescription(cmd, lang) {
    try {
        if (!cmd) return '';
        if (typeof cmd.description === 'function') return normalizeString(cmd.description(lang));
        if (typeof cmd.description === 'string') return normalizeString(cmd.description);
        if (typeof cmd.Description === 'function') return normalizeString(cmd.Description(lang));
        if (typeof cmd.Description === 'string') return normalizeString(cmd.Description);
        return '';
    } catch {
        return '';
    }
}

function safeGetCategory(rawCategory, sourceFile, rootDirName, lang) {
    const resolved = safeCallMaybeFn(rawCategory, lang);
    const asText = normalizeString(resolved);
    if (asText) return translateKnownCategory(asText, lang);
    const fromPath = categoryFromSourceFile(sourceFile, rootDirName) || 'Other';
    return translateKnownCategory(fromPath, lang);
}

function canonicalCategoryKey(value) {
    const s = normalizeString(value);
    if (!s) return '';
    const upper = s.toUpperCase();

    if (upper.includes('CATEGORY_ECONOMIA') || upper.includes('ECONOMIA') || upper.includes('ECONOMÍA') || upper === 'ECONOMY') return 'economy';
    if (upper.includes('CATEGORY_HERRAMIENTAS') || upper.includes('HERRAMIENTAS') || upper === 'TOOLS' || upper === 'TOOL') return 'tools';
    if (upper.includes('CATEGORY_MUSICA') || upper.includes('MUSICA') || upper.includes('MÚSICA') || upper === 'MUSIC') return 'music';
    if (upper.includes('CATEGORY_ADMIN') || upper.includes('ADMINISTRACION') || upper.includes('ADMINISTRACIÓN') || upper === 'ADMIN' || upper === 'ADMINISTRATION') return 'admin';
    if (upper.includes('CATEGORY_MODERATION') || upper.includes('MODERATION') || upper.includes('MODERACION') || upper.includes('MODERACIÓN')) return 'moderation';
    if (upper.includes('CATEGORY_FUN') || upper === 'FUN') return 'fun';
    if (upper.includes('CATEGORY_GAMES') || upper === 'GAMES' || upper.includes('JUEGOS') || upper.includes('JUEGO')) return 'games';
    if (upper.includes('CATEGORY_ROOT') || upper === 'ROOT' || upper.includes('OWNER') || upper.includes('PROPIETARIO')) return 'root';
    if (upper.includes('CATEGORY_TAROT') || upper === 'TAROT') return 'tarot';

    return '';
}

function translateKnownCategory(value, lang) {
    const s = normalizeString(value);
    if (!s) return '';

    // Si ya viene como key i18n, intentamos traducirlo.
    if (s.startsWith('commands:CATEGORY_')) {
        const t = moxi.translate(s, lang);
        return (t && t !== s) ? t : s;
    }

    const canon = canonicalCategoryKey(s);
    if (!canon) return s;

    const keyByCanon = {
        economy: 'commands:CATEGORY_ECONOMIA',
        tools: 'commands:CATEGORY_HERRAMIENTAS',
        music: 'commands:CATEGORY_MUSICA',
        admin: 'commands:CATEGORY_ADMIN',
        moderation: 'commands:CATEGORY_MODERATION',
        fun: 'commands:CATEGORY_FUN',
        games: 'commands:CATEGORY_GAMES',
        root: 'commands:CATEGORY_ROOT',
        tarot: 'commands:CATEGORY_TAROT',
    };

    const nsKey = keyByCanon[canon];
    if (!nsKey) return s;

    const translated = moxi.translate(nsKey, lang);
    return (translated && translated !== nsKey) ? translated : s;
}

function safeGetUsage(cmd, lang) {
    const raw = cmd?.usage ?? cmd?.Usage;
    const resolved = safeCallMaybeFn(raw, lang);
    return normalizeString(resolved);
}

function categoryFromSourceFile(sourceFile, rootDirName) {
    // Ej: .../Comandos/Tools/help.js -> Tools
    // Ej: .../Slashcmd/Moderation/ban.js -> Moderation
    if (!sourceFile) return '';
    const parts = String(sourceFile).split(/[/\\]+/g);
    const rootIdx = parts.findIndex((p) => String(p).toLowerCase() === String(rootDirName).toLowerCase());
    if (rootIdx >= 0 && parts.length > rootIdx + 1) return normalizeString(parts[rootIdx + 1]);
    return '';
}

function buildPrefixDoc(cmd, botId) {
    const lang = getRegistryLang();
    const name = normalizeString(cmd?.name).toLowerCase();
    const category = safeGetCategory(cmd?.Category, cmd?.__sourceFile, 'Comandos', lang);
    const aliases = Array.isArray(cmd?.alias)
        ? cmd.alias
        : (Array.isArray(cmd?.aliases) ? cmd.aliases : []);

    const permissions = Array.isArray(cmd?.permissions)
        ? cmd.permissions
        : (Array.isArray(cmd?.Permissions) ? cmd.Permissions : []);

    const cooldownRaw = cmd?.cooldown ?? cmd?.Cooldown;
    const cooldown = Number.isFinite(Number(cooldownRaw)) ? Number(cooldownRaw) : undefined;

    return {
        botId,
        type: 'prefix',
        name,
        category,
        description: safeGetDescription(cmd, lang),
        usage: safeGetUsage(cmd, lang),
        aliases: Array.from(new Set((aliases || []).map((a) => normalizeString(a).toLowerCase()).filter(Boolean))),
        cooldown,
        permissions: Array.from(new Set((permissions || []).map((p) => normalizeString(p)).filter(Boolean))),
        sourceFile: normalizeString(cmd?.__sourceFile),
        lastSeenAt: new Date(),
    };
}

function trySlashToJson(slashCmd) {
    try {
        const data = slashCmd?.data || (slashCmd?.Command && slashCmd.Command.data);
        if (!data) return null;
        if (typeof data.toJSON === 'function') return data.toJSON();
        return null;
    } catch {
        return null;
    }
}

function buildSlashDoc(slashCmd, botId) {
    const lang = getRegistryLang();
    const json = applySlashI18nToCommandJson(trySlashToJson(slashCmd) || {});
    const name = normalizeString(json?.name || slashCmd?.name).toLowerCase();
    const category = safeGetCategory(slashCmd?.Category, slashCmd?.__sourceFile, 'Slashcmd', lang);

    // Algunos slash modules también exportan description; si no, usamos el json.description.
    const description = normalizeString(json?.description) || safeGetDescription(slashCmd, lang);

    // Guardamos el payload completo (sin funciones) para “describir bien” el comando.
    // Incluye options, default_member_permissions, dm_permission, nsfw, etc.
    return {
        botId,
        type: 'slash',
        name,
        category,
        description,
        usage: '',
        aliases: [],
        permissions: [],
        slash: json,
        sourceFile: normalizeString(slashCmd?.__sourceFile),
        lastSeenAt: new Date(),
    };
}

async function syncCommandRegistry(Moxi, opts = {}) {
    const enabled = opts.enabled ?? (process.env.SYNC_COMMAND_REGISTRY !== '0');
    if (!enabled) return { ok: false, reason: 'disabled' };

    // Por defecto: borrar comandos que ya no existen en el código.
    // Puedes desactivarlo con COMMAND_REGISTRY_DELETE_MISSING=0 o opts.deleteMissing=false.
    const deleteMissingEnv = process.env.COMMAND_REGISTRY_DELETE_MISSING;
    const deleteMissing = (opts.deleteMissing !== undefined)
        ? !!opts.deleteMissing
        : (deleteMissingEnv === undefined ? true : String(deleteMissingEnv).trim() !== '0');

    if (typeof process.env.MONGODB !== 'string' || !process.env.MONGODB.trim()) {
        return { ok: false, reason: 'no-db' };
    }

    await ensureMongoConnection();

    const botId = normalizeString(Moxi?.user?.id) || 'unknown-bot';

    const prefix = Array.from(Moxi?.commands?.values?.() || []);
    const slash = Array.from(Moxi?.slashcommands?.values?.() || []);

    const docs = [];
    const syncStamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    for (const c of prefix) {
        const doc = buildPrefixDoc(c, botId);
        if (doc.name) docs.push({ ...doc, syncStamp });
    }
    for (const s of slash) {
        const doc = buildSlashDoc(s, botId);
        if (doc.name) docs.push({ ...doc, syncStamp });
    }

    if (!docs.length) {
        logger.warn('[commandRegistry] No se detectaron comandos para sincronizar');
        return { ok: true, upserted: 0 };
    }

    const ops = docs.map((doc) => ({
        updateOne: {
            filter: { botId: doc.botId, type: doc.type, name: doc.name },
            update: { $set: doc },
            upsert: true,
        },
    }));

    let res;
    try {
        res = await CommandRegistry.bulkWrite(ops, { ordered: false });
    } catch (err) {
        const code = err?.code;
        const codeName = err?.codeName;
        const msg = String(err?.message || '').toLowerCase();
        const isUnauthorized = code === 13 || codeName === 'Unauthorized' || msg.includes('not authorized');
        if (isUnauthorized) {
            logger.error(
                '[commandRegistry] Sin permisos para escribir en MongoDB. ' +
                'Necesitas rol readWrite (o dbOwner) en la BD configurada para poder crear/actualizar la colección de comandos.'
            );
            return { ok: false, reason: 'unauthorized' };
        }
        logger.error('[commandRegistry] Falló la sincronización a MongoDB');
        logger.error(err?.message || err);
        return { ok: false, reason: 'error' };
    }

    const upserted = res?.upsertedCount ?? 0;
    const modified = res?.modifiedCount ?? 0;
    const matched = res?.matchedCount ?? 0;

    let deleted = 0;
    if (deleteMissing) {
        try {
            const delRes = await CommandRegistry.deleteMany({ botId, syncStamp: { $ne: syncStamp } });
            deleted = delRes?.deletedCount ?? 0;
        } catch (err) {
            // Si hay permisos para escribir pero no para borrar, lo registramos.
            logger.warn('[commandRegistry] No se pudieron borrar comandos antiguos (best-effort)');
            logger.warn(err?.message || err);
        }
    }

    logger.info(
        `${EMOJIS.burger || '📦'} CommandRegistry sync: ` +
        `${docs.length} comandos (prefix=${prefix.length}, slash=${slash.length}), ` +
        `upserted=${upserted}, modified=${modified}, matched=${matched}` +
        (deleteMissing ? `, deleted=${deleted}` : '')
    );

    return { ok: true, total: docs.length, upserted, modified, matched, deleted };
}

module.exports = {
    syncCommandRegistry,
};
