const LEVELS = {
  silent: -1,
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Evitar require circular
let client = null;
function getClient() {
  // IMPORTANTE: no arrancar el bot desde scripts/CLI
  // ni desde procesos donde el cliente no está inicializado.
  return client;
}

const debug = require('./debug');

function anyDebugEnvEnabled() {
  if (debug.isGlobalDebugEnabled()) return true;
  for (const [k, v] of Object.entries(process.env || {})) {
    if(k && k.endsWith('_DEBUG')) {
      if (debug.normalizeEnvValue(v) === '1') return true;
    }
  }
  return false;
}

function parseLogLevel() {
  const raw = debug.normalizeEnvValue(process.env.LOG_LEVEL);
  if (raw) {
    const key = raw.toLowerCase();

    // En desarrollo solemos querer ver más logs. Si DEBUG (global o por flags)
    // está activo y LOG_LEVEL=info viene desde .env, elevamos a debug.
    if (key === 'info' && anyDebugEnvEnabled()) return LEVELS.debug;

    if (Object.prototype.hasOwnProperty.call(LEVELS, key)) return LEVELS[key];
    const asNum = Number(key);
    if (!Number.isNaN(asNum)) return asNum;
  }

  // Si hay DEBUG=1 o cualquier *_DEBUG=1, por defecto habilita debug.
  if (anyDebugEnvEnabled()) return LEVELS.debug;
  return LEVELS.info;
}

const CURRENT_LEVEL = parseLogLevel();
const SHOW_STARTUP_INFO = debug.normalizeEnvValue(process.env.SHOW_LOGGER_LEVEL_INFO);

function shouldLog(levelName) {
  const lvl = LEVELS[levelName];
  return CURRENT_LEVEL >= lvl && lvl !== undefined && lvl !== null && CURRENT_LEVEL !== LEVELS.silent;
}

function formatPrefix(levelName) {
  return `[${levelName.toUpperCase()}]`;
}

function log(levelName, ...msg) {
  if (!shouldLog(levelName)) return;
  const prefix = formatPrefix(levelName);
  let color = process.env.BOT_ACCENT_COLOR || '#E1A6FF';
  let secondaryColor = process.env.BOT_SECONDARY_COLOR || '#FFB6E6';
  if (levelName === 'startup' || levelName === 'warn') color = secondaryColor;
  // Consola
  if (levelName === 'error') console.error(prefix, ...msg);
  else if (levelName === 'warn') console.warn(prefix, ...msg);
  else console.log(prefix, ...msg);
  // Discord embed
  sendLogToDiscordChannel(levelName, prefix, color, ...msg);
}

async function sendLogToDiscordChannel(levelName, prefix, color, ...msg) {
  try {
    // Evitar side-effects en CLI
    if (process.env.DISABLE_DISCORD_LOGS === '1') return;
    try {
      const mainFile = require.main && require.main.filename ? String(require.main.filename) : '';
      if (mainFile.includes(`${require('path').sep}scripts${require('path').sep}`)) return;
    } catch {
      // ignore
    }

    const channelId = process.env.ERROR_CHANNEL_ID;
    const webhookUrl = process.env.ERROR_WEBHOOK_URL;
    // Si no hay destino, no intentamos nada.
    if (!channelId && !webhookUrl) return;

    let text = msg.map(m => (typeof m === 'object' ? JSON.stringify(m, null, 2) : String(m))).join(' ');
    if (text.length > 1900) text = text.slice(0, 1900) + '...';
    const c = getClient();
    const botName = c && c.user && c.user.username ? c.user.username : 'MoxiBot';
    const year = new Date().getFullYear();
    const embed = {
      color,
      title: `# Log: ${levelName.toUpperCase()}`,
      description: `---\n**${prefix}**\n\n${text}\n---`,
      footer: { text: `© ${botName} • ${year}` },
      timestamp: new Date().toISOString(),
    };
    // Enviar a canal si está configurado
    if (channelId) {
      const client = getClient();
      if (client && client.channels) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) channel.send({ embeds: [embed] }).catch(() => { });
      }
    }
    // Enviar a webhook si está configurado
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: botName + ' Logger',
          avatar_url: 'https://i.imgur.com/1Q9Z1Zm.png',
          embeds: [embed],
        }),
      }).catch(() => { });
    }
  } catch { }
}

function startup(...msg) {
  if (SHOW_STARTUP_INFO === '0') return;
  const prefix = formatPrefix('info');
  return console.log(prefix, ...msg);
}

function isDebugFlagEnabled(envKey) {
  return debug.isFlagEnabled(envKey);
}

function divider() {
  const prefix = formatPrefix('info');
  return console.log(prefix, '────────────────────────────────────────────');
}

module.exports = {
  // Compat: API existente
  info: (...msg) => log('info', ...msg),
  error: (...msg) => log('error', ...msg),
  warn: (...msg) => log('warn', ...msg),

  // Nuevo
  debug: (...msg) => log('debug', ...msg),
  getLevel: () => CURRENT_LEVEL,
  isDebugFlagEnabled,
  startup,
  divider,
};
