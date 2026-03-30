const crypto = require('node:crypto');
const { randomCode } = require('./captcha');

const challenges = new Map();

function nowMs() {
  return Date.now();
}

function createNonce() {
  return crypto.randomBytes(8).toString('hex');
}

function randomInt(min, max) {
  const a = Math.ceil(Number(min));
  const b = Math.floor(Number(max));
  const lo = Number.isFinite(a) ? a : 0;
  const hi = Number.isFinite(b) ? b : lo;
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function createChallenge({ guildId, userId, length = 6, ttlMs = 2 * 60 * 1000, maxAttempts = 3, type = 'captcha' } = {}) {
  const nonce = createNonce();
  const code = randomCode(length);
  const item = {
    nonce,
    guildId: String(guildId),
    userId: String(userId),
    type: String(type || 'captcha'),
    code,
    attempts: 0,
    maxAttempts: Math.max(1, Number(maxAttempts) || 3),
    createdAt: nowMs(),
    expiresAt: nowMs() + (Number(ttlMs) || 120000),
  };
  challenges.set(nonce, item);
  return item;
}

function createAdvancedChallenge({ guildId, userId, length = 6, ttlMs = 2 * 60 * 1000, maxAttempts = 3 } = {}) {
  const a = randomInt(2, 12);
  const b = randomInt(2, 12);
  const op = Math.random() < 0.65 ? '+' : '-';
  const question = `${a} ${op} ${b}`;
  const answer = op === '+' ? (a + b) : (a - b);

  const item = createChallenge({ guildId, userId, length, ttlMs, maxAttempts, type: 'advanced' });
  item.question = question;
  item.answer = String(answer);
  challenges.set(String(item.nonce), item);
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

function bumpAttempts(item) {
  item.attempts += 1;
  challenges.set(String(item.nonce), item);
  const remaining = Math.max(0, item.maxAttempts - item.attempts);
  if (remaining <= 0) {
    challenges.delete(String(item.nonce));
    return { ok: false, reason: 'max_attempts' };
  }
  return { ok: false, reason: 'invalid', remaining };
}

function tryVerify(nonce, { guildId, userId, input }) {
  const item = getChallenge(nonce);
  if (!item) return { ok: false, reason: 'expired' };
  if (guildId && String(guildId) !== item.guildId) return { ok: false, reason: 'mismatch' };
  if (userId && String(userId) !== item.userId) return { ok: false, reason: 'mismatch' };

  if (String(item.type || 'captcha') !== 'captcha') return { ok: false, reason: 'mismatch' };

  const expected = normalizeInput(item.code);
  const got = normalizeInput(input);

  if (got === expected) {
    challenges.delete(String(nonce));
    return { ok: true };
  }

  return bumpAttempts(item);
}

function tryVerifyAdvanced(nonce, { guildId, userId, captchaInput, mathInput }) {
  const item = getChallenge(nonce);
  if (!item) return { ok: false, reason: 'expired' };
  if (guildId && String(guildId) !== item.guildId) return { ok: false, reason: 'mismatch' };
  if (userId && String(userId) !== item.userId) return { ok: false, reason: 'mismatch' };

  if (String(item.type || '') !== 'advanced') return { ok: false, reason: 'mismatch' };

  const expectedCaptcha = normalizeInput(item.code);
  const gotCaptcha = normalizeInput(captchaInput);

  const expectedMath = String(item.answer ?? '').trim();
  const gotMath = String(mathInput ?? '').trim();

  if (gotCaptcha && gotCaptcha === expectedCaptcha && expectedMath && gotMath === expectedMath) {
    challenges.delete(String(nonce));
    return { ok: true };
  }

  return bumpAttempts(item);
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
  createAdvancedChallenge,
  getChallenge,
  consumeChallenge,
  tryVerify,
  tryVerifyAdvanced,
};
