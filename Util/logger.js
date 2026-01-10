const LEVELS = {
  silent: -1,
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const debug = require('./debug');

function anyDebugEnvEnabled() {
  if (debug.isGlobalDebugEnabled()) return true;
  for (const [k, v] of Object.entries(process.env || {})) {
    if (!k || !k.endsWith('_DEBUG')) continue;
    if (debug.normalizeEnvValue(v) === '1') return true;
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
  if (levelName === 'error') return console.error(prefix, ...msg);
  if (levelName === 'warn') return console.warn(prefix, ...msg);
  return console.log(prefix, ...msg);
}

function startup(...msg) {
  if (SHOW_STARTUP_INFO === '0') return;
  const prefix = formatPrefix('info');
  return console.log(prefix, ...msg);
}

function isDebugFlagEnabled(envKey) {
  return debug.isFlagEnabled(envKey);
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
};
