const debugHelper = require('./debugHelper');

const CACHE_TTL_MS = 5 * 60 * 1000;
const premiumCache = new Map(); // userId -> { checkedAt, active, tier, expiresAtMs }

function nowMs() {
  return Date.now();
}

function safeStr(x) {
  return String(x ?? '').trim();
}

function clampInt(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function parseDurationMs(input) {
  const raw = safeStr(input);
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (['perma', 'perm', 'lifetime', 'forever', 'infinito', 'ilimitado', 'sinfin'].includes(lower)) {
    return null; // null = lifetime
  }

  // Permitir "30" como días.
  if (/^\d+$/.test(lower)) {
    const days = clampInt(lower, 0, 36500, 0);
    if (!days) return 0;
    return days * 24 * 60 * 60 * 1000;
  }

  // Formato: 1w2d3h4m5s
  const re = /(\d+)\s*(w|wk|week|weeks|sem|semanas|semana|d|day|days|dia|dias|h|hr|hour|hours|m|min|minute|minutes|s|sec|second|seconds)/g;
  let total = 0;
  let matched = false;

  for (const m of lower.matchAll(re)) {
    matched = true;
    const amount = clampInt(m[1], 0, 365000, 0);
    const unit = m[2];

    if (!amount) continue;

    if (unit.startsWith('w') || unit.startsWith('sem')) total += amount * 7 * 24 * 60 * 60 * 1000;
    else if (unit === 'd' || unit.startsWith('day') || unit.startsWith('dia')) total += amount * 24 * 60 * 60 * 1000;
    else if (unit === 'h' || unit.startsWith('hr') || unit.startsWith('hour')) total += amount * 60 * 60 * 1000;
    else if (unit === 'm' || unit.startsWith('min') || unit.startsWith('minute')) total += amount * 60 * 1000;
    else if (unit === 's' || unit.startsWith('sec') || unit.startsWith('second')) total += amount * 1000;
  }

  if (!matched) return NaN;
  return total;
}

function formatExpiry(expiresAtMs) {
  if (expiresAtMs === null) return 'LIFETIME';
  if (!Number.isFinite(Number(expiresAtMs)) || expiresAtMs <= 0) return '—';
  return `<t:${Math.floor(expiresAtMs / 1000)}:R>`;
}

function cacheGet(userId) {
  const uid = safeStr(userId);
  if (!uid) return null;
  const hit = premiumCache.get(uid);
  if (!hit) return null;
  if ((nowMs() - hit.checkedAt) > CACHE_TTL_MS) return null;
  return hit;
}

function cacheSet(userId, value) {
  const uid = safeStr(userId);
  if (!uid) return;
  premiumCache.set(uid, { ...value, checkedAt: nowMs() });
}

function cacheInvalidate(userId) {
  const uid = safeStr(userId);
  if (!uid) return;
  premiumCache.delete(uid);
}

async function getPremiumStatus(userId, { allowCache = true } = {}) {
  const uid = safeStr(userId);
  if (!uid) return { ok: false, reason: 'missing-userId' };

  if (allowCache) {
    const hit = cacheGet(uid);
    if (hit) {
      const active = !!hit.active && (hit.expiresAtMs === null || hit.expiresAtMs > nowMs());
      return {
        ok: true,
        userId: uid,
        active,
        tier: hit.tier || (active ? 'premium' : null),
        expiresAtMs: hit.expiresAtMs,
        expiresText: active ? formatExpiry(hit.expiresAtMs) : '—',
        fromCache: true,
      };
    }
  }

  try {
    const { getPremiumUser, removePremiumUser } = require('../Models/PremiumUserSchema');

    const doc = await getPremiumUser(uid);
    if (!doc) {
      cacheSet(uid, { active: false, tier: null, expiresAtMs: null });
      return { ok: true, userId: uid, active: false, tier: null, expiresAtMs: null, expiresText: '—', fromCache: false };
    }

    const expiresAtMs = doc.expiresAt ? new Date(doc.expiresAt).getTime() : null;
    const active = expiresAtMs === null ? true : (Number.isFinite(expiresAtMs) && expiresAtMs > nowMs());

    // Limpieza best-effort si está expirado
    if (!active && expiresAtMs !== null) {
      removePremiumUser(uid).catch(() => null);
    }

    cacheSet(uid, { active, tier: doc.tier || 'premium', expiresAtMs });

    return {
      ok: true,
      userId: uid,
      active,
      tier: doc.tier || 'premium',
      expiresAtMs,
      expiresText: active ? formatExpiry(expiresAtMs) : '—',
      fromCache: false,
    };
  } catch (err) {
    debugHelper.error('premium', 'getPremiumStatus error');
    debugHelper.error('premium', err?.message || String(err));
    return { ok: false, reason: 'error', message: err?.message || String(err) };
  }
}

async function isPremiumActive(userId) {
  const st = await getPremiumStatus(userId);
  return !!st?.ok && !!st?.active;
}

async function grantPremium({ userId, tier = 'premium', durationMs = null, grantedBy = null, reason = null } = {}) {
  const uid = safeStr(userId);
  if (!uid) return { ok: false, reason: 'missing-userId' };

  const t = safeStr(tier) || 'premium';
  const dur = durationMs;
  let expiresAt = null;

  if (dur === null) {
    expiresAt = null;
  } else {
    const n = Number(dur);
    if (!Number.isFinite(n) || n < 0) return { ok: false, reason: 'bad-duration' };
    expiresAt = new Date(Date.now() + n);
  }

  try {
    const { upsertPremiumUser } = require('../Models/PremiumUserSchema');
    await upsertPremiumUser(uid, { tier: t, expiresAt, grantedBy, reason });
    cacheInvalidate(uid);
    const st = await getPremiumStatus(uid, { allowCache: false });
    return { ok: true, status: st };
  } catch (err) {
    return { ok: false, reason: 'error', message: err?.message || String(err) };
  }
}

async function revokePremium({ userId } = {}) {
  const uid = safeStr(userId);
  if (!uid) return { ok: false, reason: 'missing-userId' };

  try {
    const { removePremiumUser } = require('../Models/PremiumUserSchema');
    const removed = await removePremiumUser(uid);
    cacheInvalidate(uid);
    return { ok: true, removed };
  } catch (err) {
    return { ok: false, reason: 'error', message: err?.message || String(err) };
  }
}

module.exports = {
  parseDurationMs,
  formatExpiry,
  getPremiumStatus,
  isPremiumActive,
  grantPremium,
  revokePremium,
  cacheInvalidate,
};
