// Sync slash command IDs into MongoDB so command mentions like </bug:ID> work.
// Usage:
//   node scripts/sync_slash_command_ids.js              (global)
//   set GUILD_ID=123...; node scripts/sync_slash_command_ids.js   (guild)

require('../Util/silentDotenv')();

const { REST, Routes } = require('discord.js');
const logger = require('../Util/logger');
const { upsertDeployedCommandIds } = require('../Util/slashCommandMentions');

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

async function main() {
  if (!token || !clientId) {
    console.error('[sync_slash_command_ids] Missing TOKEN and/or CLIENT_ID');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  const list = await rest.get(route);
  const count = Array.isArray(list) ? list.length : 0;

  await upsertDeployedCommandIds({ applicationId: clientId, guildId: guildId || null, deployed: Array.isArray(list) ? list : [] });

  logger.info && logger.info('[sync_slash_command_ids] synced', count, 'commands', guildId ? `(guild ${guildId})` : '(global)');
  console.log('[sync_slash_command_ids] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
