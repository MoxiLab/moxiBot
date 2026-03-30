const buckets = new Map();

function nowMs() {
    return Date.now();
}

function safeStr(x) {
    return String(x ?? '').trim();
}

function safeInt(x, fallback) {
    const n = Number(x);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function claimRateLimit({ userId, key, windowMs = 30_000, maxHits = 3 } = {}) {
    const uid = safeStr(userId);
    const k = safeStr(key);
    const win = Math.max(250, safeInt(windowMs, 30_000));
    const max = Math.max(1, safeInt(maxHits, 3));

    if (!uid || !k) {
        return { ok: false, reason: 'invalid', message: 'Missing userId or key.' };
    }

    const id = `${uid}:${k}`;
    const t = nowMs();

    const arr = Array.isArray(buckets.get(id)) ? buckets.get(id) : [];
    const fresh = arr.filter((ts) => Number.isFinite(ts) && t - ts < win);

    if (fresh.length >= max) {
        const oldest = fresh[0];
        const nextInMs = Math.max(0, win - (t - oldest));
        buckets.set(id, fresh);
        return {
            ok: false,
            reason: 'cooldown',
            nextInMs,
            message: 'Too many requests. Please wait a moment.',
        };
    }

    fresh.push(t);
    buckets.set(id, fresh);

    return {
        ok: true,
        remaining: Math.max(0, max - fresh.length),
    };
}

module.exports = {
    claimRateLimit,
};
