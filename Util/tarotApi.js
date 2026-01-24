const axios = require('axios');

const TAROT_API_BASE_URL = process.env.TAROT_API_BASE_URL || 'https://tarotapi.dev/api/v1';
const TAROT_API_TIMEOUT_MS = Number(process.env.TAROT_API_TIMEOUT_MS) || 6500;

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function isTarotApiDevBase(baseUrl) {
  const s = String(baseUrl || '').toLowerCase();
  return s.includes('tarotapi.dev') || s.includes('/api/v1');
}

function safeHostLabel(baseUrl) {
  const raw = stripTrailingSlash(baseUrl);
  try {
    const u = new URL(raw);
    const includePort = String(process.env.TAROT_API_SOURCE_INCLUDE_PORT || '').trim() === '1';
    if (includePort && u.port) return `${u.hostname}:${u.port}`;
    return u.hostname;
  } catch {
    return raw || 'tarot';
  }
}

function toSlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toAbsoluteUrl(baseUrl, maybePath) {
  const base = stripTrailingSlash(baseUrl);
  const v = String(maybePath || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (!base) return v;
  if (v.startsWith('/')) return `${base}${v}`;
  return `${base}/${v}`;
}

function normalizeTarotCardApiCard(card, baseUrl) {
  if (!card) return null;
  const name = String(card.name || '').trim();
  const description = String(card.description || '').trim();
  const image = String(card.image || '').trim();

  return {
    name: name || 'Tarot',
    name_short: toSlug(name) || null,
    type: null,
    suit: null,
    value: null,
    value_int: null,
    meaning_up: description || null,
    meaning_rev: description || null,
    desc: description || null,
    image: image || null,
    image_url: toAbsoluteUrl(baseUrl, image),
  };
}

function sampleArray(arr, count) {
  const list = Array.isArray(arr) ? arr.filter(Boolean) : [];
  if (!list.length) return [];
  const n = Math.min(count, list.length);
  const picked = [];
  const used = new Set();
  while (picked.length < n) {
    const idx = Math.floor(Math.random() * list.length);
    if (used.has(idx)) continue;
    used.add(idx);
    picked.push(list[idx]);
  }
  return picked;
}

function clampInt(n, min, max) {
  const v = Number.parseInt(String(n), 10);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

async function getRandomTarotCards(count = 1) {
  const n = clampInt(count, 1, 10);
  try {
    const base = stripTrailingSlash(TAROT_API_BASE_URL);

    // tarotapi.dev (formato: { cards: [...] })
    if (isTarotApiDevBase(base)) {
      const url = `${base}/cards/random?n=${n}`;
      const res = await axios.get(url, { timeout: TAROT_API_TIMEOUT_MS });
      const cards = Array.isArray(res?.data?.cards) ? res.data.cards : [];
      return cards.filter(Boolean);
    }

    // krates98/tarotcardapi (formato: objeto o array)
    if (n === 1) {
      const url = `${base}/cards/onecard`;
      const res = await axios.get(url, { timeout: TAROT_API_TIMEOUT_MS });
      const card = normalizeTarotCardApiCard(res?.data, base);
      return card ? [card] : [];
    }

    const url = `${base}/cards`;
    const res = await axios.get(url, { timeout: TAROT_API_TIMEOUT_MS });
    const rawCards = Array.isArray(res?.data) ? res.data : [];
    const normalized = rawCards.map((c) => normalizeTarotCardApiCard(c, base)).filter(Boolean);
    return sampleArray(normalized, n);
  } catch {
    return null;
  }
}

function getTarotApiSourceLabel() {
  const override = String(process.env.TAROT_API_SOURCE_LABEL || '').trim();
  if (override) return override;
  return safeHostLabel(TAROT_API_BASE_URL);
}

module.exports = {
  getRandomTarotCards,
  TAROT_API_BASE_URL,
  getTarotApiSourceLabel,
};
