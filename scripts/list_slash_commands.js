require('../Util/silentDotenv')();
const { REST, Routes } = require('discord.js');
const logger = require('../Util/logger');

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        if (guildId) {
            const cmds = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
            console.log('Guild commands:', cmds.map(c => ({ name: c.name, description: c.description, id: c.id })));
        }
        const global = await rest.get(Routes.applicationCommands(clientId));
        console.log('Global commands:', global.map(c => ({ name: c.name, description: c.description, id: c.id })));
    } catch (e) {
        logger.error('[list-slash] error', e);
        console.error(e);
    }
})();
