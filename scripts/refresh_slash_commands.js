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
let guildId = process.env.GUILD_ID; // optional
const DO_CLEAR = process.argv.includes('--clear');

function getArgValue(flagName) {
    const argv = process.argv || [];
    const eq = argv.find((a) => typeof a === 'string' && a.startsWith(`${flagName}=`));
    if (eq) return eq.slice(flagName.length + 1) || null;
    const idx = argv.indexOf(flagName);
    if (idx !== -1) return argv[idx + 1] || null;
    return null;
}

// CLI overrides
// - `--global`: fuerza deploy global
// - `--guild <id>` o `--guild=<id>`: fuerza deploy por guild (instantáneo)
if (process.argv.includes('--global')) {
    guildId = null;
} else {
    const cliGuild = getArgValue('--guild');
    if (cliGuild) guildId = cliGuild;
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

const slashRoot = path.join(__dirname, '..', 'Slashcmd');
const commands = [];
const commandNames = [];

async function loadCommands() {
    // Wait for i18n to finish initialization (fallback after 2s)
    try {
        if (moxi && moxi.i18next && !moxi.i18next.isInitialized) {
            await Promise.race([
                new Promise((res) => moxi.i18next.on('initialized', res)),
                new Promise((res) => setTimeout(res, 2000)),
            ]);
        }
    } catch (e) {
        // ignore
    }

    const files = collectSlashFiles(slashRoot);
    for (const f of files) {
        try {
            const mod = require(f);
            const data = mod?.data || (mod?.Command && mod.Command.data);
            if (data && typeof data.toJSON === 'function') {
                commands.push(data.toJSON());
                if (data.name) commandNames.push(data.name);
            }
        } catch (e) {
            logger.error('[refresh-slash] failed loading', f, e);
        }
    }
}

if (!token) {
    throw new Error('[refresh-slash] missing TOKEN environment variable');
}
if (!clientId) {
    throw new Error('[refresh-slash] missing CLIENT_ID environment variable');
}

const rest = new REST({ version: '10' }).setToken(token);

async function discordPutJson(route, body, { timeoutMs = 45_000 } = {}) {
    // route can be a full URL or a Discord API route starting with '/'.
    const url = String(route).startsWith('http')
        ? String(route)
        : `https://discord.com/api/v10${String(route).startsWith('/') ? '' : '/'}${route}`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                Authorization: `Bot ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body ?? []),
            signal: controller.signal,
        });
        const text = await res.text();
        if (!res.ok) {
            const err = new Error(`[refresh-slash] Discord API ${res.status} ${res.statusText}: ${text || '(empty body)'}`);
            err.status = res.status;
            throw err;
        }
        try {
            return text ? JSON.parse(text) : [];
        } catch {
            return [];
        }
    } finally {
        clearTimeout(t);
    }
}

(async () => {
    logger.startup('[refresh-slash] starting command refresh');
    try {
        await loadCommands();
        logger.startup(`[refresh-slash] loaded ${commands.length} commands: ${commandNames.join(', ') || 'none'}`);
        logger.startup(`[refresh-slash] target: ${guildId ? `guild:${guildId}` : 'global'}`);
        if (DO_CLEAR) {
            logger.startup('[refresh-slash] clearing existing commands (--clear)...');
            // Nota: borrar y re-crear en GLOBAL consume el cupo diario de creaciones.
            // Solo úsalo si de verdad quieres resetear todo.
            if (guildId) {
                await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            } else {
                await discordPutJson(Routes.applicationCommands(clientId), []);
            }
        } else {
            logger.startup('[refresh-slash] skipping clear (recomendado).');
        }
        logger.startup('[refresh-slash] updating commands...');
        if (guildId) {
            const res = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            logger.startup('[refresh-slash] updated guild ' + guildId + ' count ' + res.length);
        } else {
            const res = await discordPutJson(Routes.applicationCommands(clientId), commands);
            const count = Array.isArray(res) ? res.length : 0;
            logger.startup('[refresh-slash] updated global count ' + count);
            logger.startup('[refresh-slash] nota: el GLOBAL puede tardar en reflejarse (minutos-horas).');
            logger.startup('[refresh-slash] TIP: evita redeploys global frecuentes, Discord limita las creaciones diarias (código 30034).');
        }
        logger.startup('[refresh-slash] refresh completed');
        process.exitCode = 0;
    } catch (e) {
        logger.error('[refresh-slash] error', e);
        console.error(e);
        process.exitCode = 1;
    } finally {
        // Cierra conexiones abiertas por side-effects (mongoose, etc.) para evitar asserts en Node 24.
        try {
            // eslint-disable-next-line global-require
            const { mongoose } = require('../Util/mongoConnect');
            if (mongoose?.connection?.readyState === 1) {
                await mongoose.disconnect();
            }
        } catch {
            // ignore
        }
    }
})();
