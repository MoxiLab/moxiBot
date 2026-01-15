require('../Util/silentDotenv')();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) throw new Error('[test-global] missing TOKEN');
if (!clientId) throw new Error('[test-global] missing CLIENT_ID');

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        const before = await rest.get(Routes.applicationCommands(clientId));
        console.log('[test-global] before count:', Array.isArray(before) ? before.length : before);

        // Try deploying a single minimal command globally.
        const ping = new SlashCommandBuilder().setName('moxi-ping').setDescription('Ping (test)');
        const result = await rest.put(Routes.applicationCommands(clientId), { body: [ping.toJSON()] });
        console.log('[test-global] updated count:', Array.isArray(result) ? result.length : result);

        const after = await rest.get(Routes.applicationCommands(clientId));
        console.log('[test-global] after count:', Array.isArray(after) ? after.length : after);
        console.log('[test-global] names:', (after || []).map((c) => c.name).join(', '));

        process.exitCode = 0;
    } catch (e) {
        console.error('[test-global] ERROR');
        console.error(e);
        process.exitCode = 1;
    }
})();
