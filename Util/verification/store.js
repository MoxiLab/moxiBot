const crypto = require('node:crypto');
const { randomCode } = require('./captcha');

const challenges = new Map();

function nowMs() {
  return Date.now();
}

function createNonce() {
  return crypto.randomBytes(8).toString('hex');
}

function createChallenge({ guildId, userId, length = 6, ttlMs = 2 * 60 * 1000, maxAttempts = 3 }) {
  const nonce = createNonce();
  const code = randomCode(length);
  const item = {
    nonce,
    guildId: String(guildId),
    userId: String(userId),
    code,
    attempts: 0,
    maxAttempts: Math.max(1, Number(maxAttempts) || 3),
    createdAt: nowMs(),
    expiresAt: nowMs() + (Number(ttlMs) || 120000),
  };
  challenges.set(nonce, item);
  return item;
}

function getChallenge(nonce) {
  if (!nonce) return null;
  const item = challenges.get(String(nonce));
  if (!item) return null;
  if (item.expiresAt <= nowMs()) {
    challenges.delete(String(nonce));
    return null;
  }
  return item;
}

function consumeChallenge(nonce) {
  const item = getChallenge(nonce);
  if (!item) return null;
  challenges.delete(String(nonce));
  return item;
}

function normalizeInput(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function tryVerify(nonce, { guildId, userId, input }) {
  const item = getChallenge(nonce);
  if (!item) return { ok: false, reason: 'expired' };
  if (guildId && String(guildId) !== item.guildId) return { ok: false, reason: 'mismatch' };
  if (userId && String(userId) !== item.userId) return { ok: false, reason: 'mismatch' };

  const expected = normalizeInput(item.code);
  const got = normalizeInput(input);

  if (got === expected) {
    challenges.delete(String(nonce));
    return { ok: true };
  }

  item.attempts += 1;
  challenges.set(String(nonce), item);
  const remaining = Math.max(0, item.maxAttempts - item.attempts);
  if (remaining <= 0) {
    challenges.delete(String(nonce));
    return { ok: false, reason: 'max_attempts' };
  }

  return { ok: false, reason: 'invalid', remaining };
}

// Best-effort cleanup
setInterval(() => {
  const t = nowMs();
  for (const [k, v] of challenges.entries()) {
    if (!v || v.expiresAt <= t) challenges.delete(k);
  }
}, 60 * 1000).unref?.();

module.exports = {
  createChallenge,
  getChallenge,
  consumeChallenge,
  tryVerify,
};
