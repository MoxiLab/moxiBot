const {
    getMaintenanceState,
    setMaintenanceState,
} = require('../Models/BotMaintenanceSchema');

const DEFAULT_TTL_MS = Number.parseInt(process.env.MAINTENANCE_CACHE_TTL_MS || '', 10) || 10_000;

let cache = {
    expiresAt: 0,
    state: {
        enabled: false,
        reason: '',
        updatedBy: '',
        updatedByTag: '',
        updatedAt: null,
    },
};

function invalidateMaintenanceCache() {
    cache.expiresAt = 0;
}

async function getMaintenanceStateCached(ttlMs = DEFAULT_TTL_MS) {
    const now = Date.now();
    if (cache.expiresAt > now) return cache.state;

    try {
        const state = await getMaintenanceState();
        cache = {
            state,
            expiresAt: now + ttlMs,
        };
        return state;
    } catch {
        // Fallback seguro: mantener último estado en memoria si falla DB.
        cache.expiresAt = now + ttlMs;
        return cache.state;
    }
}

async function setMaintenanceStateCached(input) {
    try {
        const state = await setMaintenanceState(input);
        cache = {
            state,
            expiresAt: Date.now() + DEFAULT_TTL_MS,
        };
        return state;
    } catch {
        // Fallback sin DB: aplicar en memoria para no dejar roto el flujo.
        const now = new Date();
        const enabled = !!input?.enabled;
        cache = {
            state: {
                enabled,
                reason: enabled ? String(input?.reason || '').trim().slice(0, 500) : '',
                updatedBy: input?.updatedBy ? String(input.updatedBy) : '',
                updatedByTag: input?.updatedByTag ? String(input.updatedByTag) : '',
                updatedAt: now,
            },
            expiresAt: Date.now() + DEFAULT_TTL_MS,
        };
        return cache.state;
    }
}

module.exports = {
    getMaintenanceStateCached,
    setMaintenanceStateCached,
    invalidateMaintenanceCache,
};
