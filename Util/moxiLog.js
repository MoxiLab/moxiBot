const logger = require('./logger');
const { createFeatureLogger } = require('./featureDebug');

function log(...msg) {
    return logger.info(...msg);
}

function debug(...msg) {
    return logger.debug(...msg);
}

function feature(featureName, label, options) {
    return createFeatureLogger(featureName, label, options);
}

module.exports = {
    log,
    debug,
    warn: (...msg) => logger.warn(...msg),
    error: (...msg) => logger.error(...msg),
    feature,
};
