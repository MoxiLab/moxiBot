require('../Util/silentDotenv')();
// Ensure i18n is loaded before requiring Slashcmd modules so translations
// are available synchronously when commands are constructed.
const moxi = require('..//i18n');
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../Util/logger');

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) throw new Error('[deploy-guilds] missing TOKEN environment variable');
if (!clientId) throw new Error('[deploy-guilds] missing CLIENT_ID environment variable');

function parseGuildIds(argv) {
    // Accept:
    // - --guilds 1,2,3
    // - --guilds=1,2,3
    // - --guild 1 --guild 2 (repeatable)
    const ids = [];

    const eq = argv.find((a) => typeof a === 'string' && a.startsWith('--guilds='));
    const argIdx = argv.indexOf('--guilds');
    const rawList = eq ? eq.slice('--guilds='.length) : (argIdx !== -1 ? argv[argIdx + 1] : null);
    if (rawList) {
        for (const part of String(rawList).split(/[,\s]+/g)) {
            const s = part.trim();
            if (s) ids.push(s);
        }
    }

    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--guild' && argv[i + 1]) ids.push(String(argv[i + 1]));
        if (typeof argv[i] === 'string' && argv[i].startsWith('--guild=')) ids.push(argv[i].slice('--guild='.length));
    }

    // Env fallback: GUILD_IDS=1,2,3
    if (!ids.length && process.env.GUILD_IDS) {
        for (const part of String(process.env.GUILD_IDS).split(/[,\s]+/g)) {
            const s = part.trim();
            if (s) ids.push(s);
        }
    }

    // De-dupe + sanitize
    return Array.from(new Set(ids.map((x) => x.trim()).filter(Boolean)));
}

function isLikelyGuildId(value) {
    const s = String(value || '').trim();
    return /^\d{17,20}$/.test(s);
}

async function loadGuildIdsFromDb() {
    if (!process.env.MONGODB) {
        throw new Error('[deploy-guilds] MONGODB vacío: no puedo auto-descubrir guilds desde la base de datos.');
    }

    const { ensureMongoConnection, mongoose } = require('../Util/mongoConnect');
    const conn = await ensureMongoConnection();
    const db = conn.db;

    const candidates = new Set();
    const sources = [
        { col: 'guilds', fields: ['guildID', 'guildId', 'id'] },
        { col: 'prefixes', fields: ['guildID', 'guildId', 'id'] },
        { col: 'languages', fields: ['guildID', 'guildId', 'id'] },
        { col: 'slash_command_ids', fields: ['guildId'] },
    ];

    for (const src of sources) {
        for (const field of src.fields) {
            try {
                const vals = await db.collection(src.col).distinct(field);
                for (const v of vals || []) {
                    if (isLikelyGuildId(v)) candidates.add(String(v));
                }
            } catch {
                // colección/campo no existe; ignorar
            }
        }
    }

    // Cierra conexión si este script la abrió.
    try {
        if (mongoose?.connection?.readyState === 1) {
            await mongoose.disconnect();
        }
    } catch {
        // ignore
    }

    return Array.from(candidates).sort();
}

function collectSlashFiles(root) {
    if (!fs.existsSync(root)) return [];
    const out = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const full = path.join(root, entry.name);
        if (entry.isDirectory()) out.push(...collectSlashFiles(full));
        else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

async function loadCommands() {
    // Wait for i18n to finish initialization (fallback after 2s)
    try {
        if (moxi && moxi.i18next && !moxi.i18next.isInitialized) {
            await Promise.race([
                new Promise((res) => moxi.i18next.on('initialized', res)),
                new Promise((res) => setTimeout(res, 2000)),
            ]);
        }
    } catch {
        // ignore
    }

    const slashRoot = path.join(__dirname, '..', 'Slashcmd');
    const files = collectSlashFiles(slashRoot);
    const commands = [];
    const names = [];

    for (const f of files) {
        try {
            const mod = require(f);
            const data = mod?.data || (mod?.Command && mod.Command.data);
            if (data && typeof data.toJSON === 'function') {
                const json = data.toJSON();
                commands.push(json);
                if (json?.name) names.push(json.name);
            }
        } catch (e) {
            logger.error('[deploy-guilds] failed loading', f, e);
        }
    }

    return { commands, names };
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

(async () => {
    const argv = process.argv.slice(2);
    const wantDbGuilds = argv.includes('--all') || argv.includes('--from-db');
    const excluded = new Set(
        String(
            (argv.find((a) => typeof a === 'string' && a.startsWith('--exclude=')) || '').slice('--exclude='.length) ||
            (argv.includes('--exclude') ? argv[argv.indexOf('--exclude') + 1] : '') ||
            process.env.EXCLUDE_GUILD_IDS ||
            ''
        )
            .split(/[,\s]+/g)
            .map((x) => x.trim())
            .filter(Boolean)
    );

    let guildIds = parseGuildIds(argv);
    if (!guildIds.length && wantDbGuilds) {
        guildIds = await loadGuildIdsFromDb();
    }

    if (excluded.size) {
        guildIds = guildIds.filter((g) => !excluded.has(String(g)));
    }
    const doClear = argv.includes('--clear');

    if (!guildIds.length) {
        console.error('[deploy-guilds] No guild IDs provided. Use:');
        console.error('  node ./scripts/deploy_slash_to_guilds.js --guilds 111,222,333');
        console.error('  node ./scripts/deploy_slash_to_guilds.js --guild 111 --guild 222');
        console.error('  node ./scripts/deploy_slash_to_guilds.js --all   (usa MongoDB para descubrir guilds)');
        console.error('Opcional: --exclude 111,222  (o env EXCLUDE_GUILD_IDS=111,222)');
        console.error('Or set env var: GUILD_IDS=111,222,333');
        process.exitCode = 1;
        return;
    }

    logger.startup('[deploy-guilds] starting deploy');
    const { commands, names } = await loadCommands();
    logger.startup(`[deploy-guilds] loaded ${commands.length} commands: ${names.join(', ') || 'none'}`);

    const rest = new REST({ version: '10' }).setToken(token);

    for (const gid of guildIds) {
        try {
            logger.startup(`[deploy-guilds] deploying to guild:${gid} ...`);
            if (doClear) {
                await rest.put(Routes.applicationGuildCommands(clientId, gid), { body: [] });
            }
            const res = await rest.put(Routes.applicationGuildCommands(clientId, gid), { body: commands });
            logger.startup(`[deploy-guilds] ok guild:${gid} count ${Array.isArray(res) ? res.length : 0}`);
        } catch (e) {
            // Handle rate limit hints if present
            const retryAfter = e?.rawError?.retry_after || e?.retry_after || null;
            logger.error('[deploy-guilds] failed guild', gid, e?.message || e);
            if (retryAfter) {
                const ms = Math.ceil(Number(retryAfter) * 1000);
                logger.warn && logger.warn(`[deploy-guilds] rate-limited; sleeping ${ms}ms then continuing...`);
                await sleep(ms);
            }
        }
    }

    logger.startup('[deploy-guilds] done');
    process.exitCode = 0;
})();
