const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");
const logger = require('../Util/logger');
const { isTestMode } = require('../Util/runtimeMode');
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

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

function loadSlashCommands() {
  const commands = [];
  for (const filePath of collectSlashFiles(slashRoot)) {
    try {
      const slash = require(filePath);
      const data = slash?.data || (slash?.Command && slash.Command.data);
      if (data && typeof data.toJSON === 'function') commands.push(data.toJSON());
      else console.warn && console.warn('[slash] invalid export in', filePath);
    } catch (err) {
      logger.error && logger.error('[slash] failed require', filePath, err);
    }
  }
  return commands;
}

async function createSlash({ commands } = {}) {
  try {
    if (!token || !clientId) {
      return logger.error && logger.error('[slash] missing TOKEN and/or CLIENT_ID in environment');
    }
    const list = Array.isArray(commands) ? commands : loadSlashCommands();
    const rest = new REST({ version: '10' }).setToken(token);
    if (!list.length) return logger.info && logger.info('[slash] no commands to deploy');
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: list });
      logger.info && logger.info('[slash] updated', list.length, 'commands (guild)', guildId);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: list });
      logger.info && logger.info('[slash] updated', list.length, 'commands (global)');
    }
  } catch (e) {
    logger.error(e);
  }
}

module.exports = {
  loadSlashCommands,
  createSlash,
};

// Only auto-deploy if explicitly enabled to avoid duplicate registrations
if (!isTestMode() && process.env.AUTO_DEPLOY_SLASH === 'true') {
  if (!guildId) {
    logger.warn && logger.warn('[slash] AUTO_DEPLOY_SLASH=true pero falta GUILD_ID: se desplegará GLOBAL y puede tardar en reflejarse. Para instantáneo, configura GUILD_ID en .env');
  }
  createSlash();
} else if (!isTestMode()) {
  console.log('[slash] AUTO_DEPLOY_SLASH not enabled — skipping automatic deployment');
}
