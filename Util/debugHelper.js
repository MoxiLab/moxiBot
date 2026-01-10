const logger = require('./logger');
const debug = require('./debug');

function formatPrefix(feature) {
    if (!feature) return '[DEBUG]';
    return `[${String(feature).toUpperCase()}]`;
}

function isEnabled(feature) {
    return debug.isFlagEnabled(feature);
}

function log(feature, ...msg) {
    if (!isEnabled(feature)) return false;
    const prefix = formatPrefix(feature);
    if (typeof logger?.debug === 'function') return logger.debug(prefix, ...msg);
    return console.log(prefix, ...msg);
}

function warn(feature, ...msg) {
    if (!isEnabled(feature)) return false;
    const prefix = formatPrefix(feature);
    if (typeof logger?.warn === 'function') return logger.warn(prefix, ...msg);
    return console.warn(prefix, ...msg);
}

function error(feature, ...msg) {
    if (!isEnabled(feature)) return false;
    const prefix = formatPrefix(feature);
    if (typeof logger?.error === 'function') return logger.error(prefix, ...msg);
    return console.error(prefix, ...msg);
}

module.exports = {
    isEnabled,
    log,
    warn,
    error,
};
