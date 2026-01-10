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
// Allow forcing global deploy via CLI flag
if (process.argv.includes('--global')) {
    guildId = null;
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

(async () => {
    logger.startup('[refresh-slash] starting command refresh');
    try {
        await loadCommands();
        logger.startup(`[refresh-slash] loaded ${commands.length} commands: ${commandNames.join(', ') || 'none'}`);
        logger.info('[refresh-slash] clearing existing commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        if (guildId) await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        logger.info('[refresh-slash] deploying fresh commands...');
        if (guildId) {
            const res = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            logger.info('[refresh-slash] deployed to guild', guildId, 'count', res.length);
        } else {
            const res = await rest.put(Routes.applicationCommands(clientId), { body: commands });
            logger.info('[refresh-slash] deployed global count', res.length);
        }
        logger.startup('[refresh-slash] refresh completed');
        process.exit(0);
    } catch (e) {
        logger.error('[refresh-slash] error', e);
        console.error(e);
        process.exit(1);
    }
})();
