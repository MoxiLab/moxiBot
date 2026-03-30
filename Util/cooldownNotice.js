const perKey = new Map();

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

// Controla si se debe mostrar un aviso de cooldown o no.
// - Sin `threshold`: muestra como máximo 1 vez por `windowMs`.
// - Con `threshold` (>1): muestra cada `threshold` intentos dentro de `windowMs`.
function shouldShowCooldownNotice({ userId, key, windowMs = 20_000, threshold = null } = {}) {
    const uid = safeStr(userId);
    const k = safeStr(key);
    if (!uid || !k) return true;

    const win = Math.max(250, safeInt(windowMs, 20_000));
    const t = nowMs();
    const id = `${uid}:${k}`;

    const state = perKey.get(id) || { lastShownAt: 0, firstAt: 0, count: 0 };

    const th = (threshold == null) ? null : safeInt(threshold, null);

    // Modo "cada N intentos": útil para alternar entre mensaje completo vs suave.
    if (Number.isFinite(th) && th > 1) {
        if (!state.firstAt || t - state.firstAt >= win) {
            state.firstAt = t;
            state.count = 0;
        }
        state.count += 1;

        if (state.count >= th) {
            state.count = 0;
            state.firstAt = t;
            state.lastShownAt = t;
            perKey.set(id, state);
            return true;
        }

        perKey.set(id, state);
        return false;
    }

    // Modo "una vez por ventana": evita spam de avisos.
    if (!state.lastShownAt || t - state.lastShownAt >= win) {
        state.lastShownAt = t;
        perKey.set(id, state);
        return true;
    }

    perKey.set(id, state);
    return false;
}

module.exports = {
    shouldShowCooldownNotice,
};
