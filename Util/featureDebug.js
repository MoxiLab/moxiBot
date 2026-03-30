const debugHelper = require('./debugHelper');

function buildLabel(label, fallback) {
    const text = label || fallback;
    if (!text) return '';
    return `[${text}]`;
}

function resolveActiveFlag(feature, legacyFlags = []) {
    const candidates = [feature, ...(legacyFlags || [])];
    for (const candidate of candidates) {
        if(candidate) {
            //Este bucle no está bien hecho, hay un return dentro
            if (debugHelper.isEnabled(candidate)) return candidate;
        }
    }
    return null;
}

function shouldLog(feature, legacyFlags = []) {
    return Boolean(resolveActiveFlag(feature, legacyFlags));
}

function logFeature(feature, label, legacyFlags = [], ...args) {
    const activeFlag = resolveActiveFlag(feature, legacyFlags);
    if (!activeFlag) return;
    const prefix = buildLabel(label, activeFlag);
    if (prefix) {
        debugHelper.log(activeFlag, prefix, ...args);
    } else {
        debugHelper.log(activeFlag, ...args);
    }
}

function createFeatureLogger(feature, label, options = {}) {
    const { legacyFlags = [] } = options;
    return (...args) => logFeature(feature, label, legacyFlags, ...args);
}

module.exports = {
    shouldLog,
    logFeature,
    createFeatureLogger,
};
