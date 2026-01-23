const { isBotOwner, isDiscordApplicationOwner } = require('./ownerPermissions');

function envBool(name, defaultValue = false) {
    const raw = String(process.env[name] ?? '').trim().toLowerCase();
    if (!raw) return defaultValue;
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y' || raw === 'on';
}

function isOwnerOnlyModeEnabled() {
    return envBool('OWNER_ONLY_MODE', false);
}

async function isOwnerUser({ client, userId } = {}) {
    if (!userId) return false;
    if (isBotOwner(userId)) return true;
    return await isDiscordApplicationOwner(client, userId);
}

function getOwnerOnlyPrefix({ fallback } = {}) {
    const raw = String(process.env.OWNER_PREFIX ?? '').trim();
    if (raw) return raw;
    return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : '.dev';
}

async function isAllowedInOwnerOnlyMode({ client, userId } = {}) {
    if (!isOwnerOnlyModeEnabled()) return true;
    if (!userId) return false;
    return await isOwnerUser({ client, userId });
}

module.exports = {
    isOwnerOnlyModeEnabled,
    isOwnerUser,
    getOwnerOnlyPrefix,
    isAllowedInOwnerOnlyMode,
};
