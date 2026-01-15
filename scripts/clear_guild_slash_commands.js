require('../Util/silentDotenv')();
const { REST, Routes } = require('discord.js');
const logger = require('../Util/logger');

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) throw new Error('[clear-guild-slash] missing TOKEN environment variable');
if (!clientId) throw new Error('[clear-guild-slash] missing CLIENT_ID environment variable');

function parseGuildIds(argv) {
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

    if (!ids.length && process.env.GUILD_IDS) {
        for (const part of String(process.env.GUILD_IDS).split(/[,\s]+/g)) {
            const s = part.trim();
            if (s) ids.push(s);
        }
    }

    return Array.from(new Set(ids.map((x) => x.trim()).filter(Boolean)));
}

function isLikelyGuildId(value) {
    const s = String(value || '').trim();
    return /^\d{17,20}$/.test(s);
}

async function loadGuildIdsFromDb() {
    if (!process.env.MONGODB) {
        throw new Error('[clear-guild-slash] MONGODB vacío: no puedo auto-descubrir guilds desde la base de datos.');
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
                // ignore
            }
        }
    }

    try {
        if (mongoose?.connection?.readyState === 1) await mongoose.disconnect();
    } catch {
        // ignore
    }

    return Array.from(candidates).sort();
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

(async () => {
    const argv = process.argv.slice(2);
    const wantDbGuilds = argv.includes('--all') || argv.includes('--from-db');
    const yes = argv.includes('--yes');

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
    if (excluded.size) guildIds = guildIds.filter((g) => !excluded.has(String(g)));

    if (!guildIds.length) {
        console.error('[clear-guild-slash] No guild IDs provided. Use:');
        console.error('  node ./scripts/clear_guild_slash_commands.js --guilds 111,222,333 --yes');
        console.error('  node ./scripts/clear_guild_slash_commands.js --all --yes   (usa MongoDB)');
        process.exitCode = 1;
        return;
    }

    if (!yes) {
        console.error('[clear-guild-slash] This will DELETE guild-specific slash commands for these guilds:');
        console.error(guildIds.map((g) => `- ${g}`).join('\n'));
        console.error('Re-run with --yes to confirm.');
        process.exitCode = 2;
        return;
    }

    const rest = new REST({ version: '10' }).setToken(token);

    logger.startup(`[clear-guild-slash] clearing ${guildIds.length} guild(s)...`);
    for (const gid of guildIds) {
        try {
            const res = await rest.put(Routes.applicationGuildCommands(clientId, gid), { body: [] });
            logger.startup(`[clear-guild-slash] ok guild:${gid} cleared count ${Array.isArray(res) ? res.length : 0}`);
        } catch (e) {
            const retryAfter = e?.rawError?.retry_after || e?.retry_after || null;
            logger.error('[clear-guild-slash] failed guild', gid, e?.message || e);
            if (retryAfter) {
                const ms = Math.ceil(Number(retryAfter) * 1000);
                logger.warn && logger.warn(`[clear-guild-slash] rate-limited; sleeping ${ms}ms then continuing...`);
                await sleep(ms);
            }
        }
    }

    logger.startup('[clear-guild-slash] done');
    process.exitCode = 0;
})();
