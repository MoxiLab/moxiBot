require('../Util/silentDotenv')();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REST, Routes } = require('discord.js');
const logger = require('../Util/logger');
// Ensure i18n is loaded before requiring Slashcmd modules so translations
// are available synchronously when commands are constructed.
const moxi = require('..//i18n');

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
let guildId = process.env.GUILD_ID; // optional

function getArgValue(flagName) {
    const argv = process.argv || [];
    const eq = argv.find((a) => typeof a === 'string' && a.startsWith(`${flagName}=`));
    if (eq) return eq.slice(flagName.length + 1) || null;
    const idx = argv.indexOf(flagName);
    if (idx !== -1) return argv[idx + 1] || null;
    return null;
}

if (process.argv.includes('--global')) {
    guildId = null;
} else {
    const cliGuild = getArgValue('--guild');
    if (cliGuild) guildId = cliGuild;
}

if (!token) throw new Error('[diff-slash] missing TOKEN environment variable');
if (!clientId) throw new Error('[diff-slash] missing CLIENT_ID environment variable');

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

function stableStringify(value) {
    if (value === null || value === undefined) return JSON.stringify(value);
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function hashCommand(cmdJson) {
    const normalized = {
        name: cmdJson?.name,
        description: cmdJson?.description,
        options: cmdJson?.options ?? [],
        dm_permission: cmdJson?.dm_permission,
        default_member_permissions: cmdJson?.default_member_permissions,
        nsfw: cmdJson?.nsfw,
    };
    const str = stableStringify(normalized);
    return crypto.createHash('sha256').update(str).digest('hex');
}

function indexByName(list) {
    const map = new Map();
    for (const cmd of list || []) {
        if (!cmd?.name) continue;
        map.set(cmd.name, cmd);
    }
    return map;
}

async function loadLocalCommands() {
    const slashRoot = path.join(__dirname, '..', 'Slashcmd');
    const files = collectSlashFiles(slashRoot);
    const local = [];

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

    for (const filePath of files) {
        try {
            const mod = require(filePath);
            const data = mod?.data || (mod?.Command && mod.Command.data);
            if (data && typeof data.toJSON === 'function') {
                const json = data.toJSON();
                local.push(json);
            }
        } catch (e) {
            logger.error('[diff-slash] failed loading', filePath, e);
        }
    }

    return local;
}

async function loadRemoteCommands(rest) {
    if (guildId) {
        const remoteGuild = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
        return { scope: `guild:${guildId}`, list: Array.isArray(remoteGuild) ? remoteGuild : [] };
    }
    const remoteGlobal = await rest.get(Routes.applicationCommands(clientId));
    return { scope: 'global', list: Array.isArray(remoteGlobal) ? remoteGlobal : [] };
}

function printList(title, names) {
    if (!names.length) return;
    console.log(`\n${title} (${names.length}):`);
    console.log(names.map((n) => `- ${n}`).join('\n'));
}

(async () => {
    const rest = new REST({ version: '10' }).setToken(token);

    try {
        const local = await loadLocalCommands();
        const { scope, list: remote } = await loadRemoteCommands(rest);

        const localByName = indexByName(local);
        const remoteByName = indexByName(remote);

        const onlyLocal = [];
        const onlyRemote = [];
        const changed = [];

        for (const [name, localCmd] of localByName) {
            const remoteCmd = remoteByName.get(name);
            if (!remoteCmd) {
                onlyLocal.push(name);
                continue;
            }
            const lh = hashCommand(localCmd);
            const rh = hashCommand(remoteCmd);
            if (lh !== rh) changed.push(name);
        }

        for (const [name] of remoteByName) {
            if (!localByName.has(name)) onlyRemote.push(name);
        }

        onlyLocal.sort();
        onlyRemote.sort();
        changed.sort();

        console.log(`[diff-slash] local commands: ${localByName.size}`);
        console.log(`[diff-slash] remote commands (${scope}): ${remoteByName.size}`);

        printList('Solo en LOCAL (no están en Discord)', onlyLocal);
        printList('Solo en DISCORD (no existen en el código)', onlyRemote);
        printList('Mismo nombre pero DISTINTO (hay que redeploy)', changed);

        if (!onlyLocal.length && !onlyRemote.length && !changed.length) {
            console.log('\n[diff-slash] OK: local y Discord coinciden.');
        }
        process.exitCode = 0;
    } catch (e) {
        logger.error('[diff-slash] error', e);
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
