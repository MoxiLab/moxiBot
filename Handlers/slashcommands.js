const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");
const logger = require('../Util/logger');
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;



const commands = [];
const slashRoot = path.join(__dirname, '..', 'Slashcmd');

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

for (const filePath of collectSlashFiles(slashRoot)) {
  try {
    console.log('[slash] loading', filePath);
    const slash = require(filePath);
    const data = slash?.data || (slash?.Command && slash.Command.data);
    if (data && typeof data.toJSON === 'function') commands.push(data.toJSON());
    else console.warn('[slash] invalid export in', filePath);
  } catch (err) {
    logger.error('[slash] failed require', filePath, err);
  }
}

const rest = new REST({ version: '10' }).setToken(token);

async function createSlash() {
  try {
    if (!token || !clientId) {
      return logger.error && logger.error('[slash] missing TOKEN and/or CLIENT_ID in environment');
    }
    if (!commands.length) return logger.info && logger.info('[slash] no commands to deploy');
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      logger.info && logger.info('[slash] updated', commands.length, 'commands (guild)', guildId);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      logger.info && logger.info('[slash] updated', commands.length, 'commands (global)');
    }
  } catch (e) {
    logger.error(e);
  }
}

// Only auto-deploy if explicitly enabled to avoid duplicate registrations
if (process.env.AUTO_DEPLOY_SLASH === 'true') {
  if (!guildId) {
    logger.warn && logger.warn('[slash] AUTO_DEPLOY_SLASH=true pero falta GUILD_ID: se desplegará GLOBAL y puede tardar en reflejarse. Para instantáneo, configura GUILD_ID en .env');
  }
  createSlash();
} else {
  console.log('[slash] AUTO_DEPLOY_SLASH not enabled — skipping automatic deployment');
}
