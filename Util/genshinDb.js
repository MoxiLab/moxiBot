const axios = require('axios');
const { normalizeCharacterKey } = require('./genshinRoster');

const GENSHIN_DB_BASE = 'https://genshin-db-api.vercel.app/api/v5';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const queryCache = new Map();
const nameCache = new Map();
const inFlight = new Map();
const genericCache = new Map();
let configCache = null;
let configCacheAt = 0;

function buildEnkaImageFromFile(fileName) {
    const clean = String(fileName || '').trim();
    if (!clean) return null;
    return `https://enka.network/ui/${clean}.png`;
}

function toCharacterMeta(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name || '').trim();
    if (!name) return null;

    const elementText = String(raw.elementText || '').trim();
    const weaponText = String(raw.weaponText || '').trim();
    const images = raw.images && typeof raw.images === 'object' ? raw.images : {};

    return {
        id: raw.id ? String(raw.id) : null,
        name,
        rarity: raw.rarity ? `${Number(raw.rarity) || 0}★` : 'N/D',
        element: elementText || 'N/D',
        weaponType: weaponText || 'N/D',
        imageUrl: images.mihoyo_sideIcon || images.hoyowiki_icon || buildEnkaImageFromFile(images.filename_sideIcon),
        cardImageUrl: images.mihoyo_icon || buildEnkaImageFromFile(images.filename_gachaSlice),
        fullImageUrl: buildEnkaImageFromFile(images.filename_gachaSplash),
        source: 'genshin-db',
    };
}

function getFreshCache(cache, key) {
    const row = cache.get(key);
    if (!row) return null;
    if ((Date.now() - row.at) > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return row.value;
}

function setCache(cache, key, value) {
    cache.set(key, { at: Date.now(), value: value || null });
}

async function fetchCharacterByQuery(query) {
    const rawQuery = String(query || '').trim();
    const queryKey = normalizeCharacterKey(rawQuery);
    if (!queryKey) return null;

    const fromQueryCache = getFreshCache(queryCache, queryKey);
    if (fromQueryCache !== null) {
        return fromQueryCache;
    }

    const fromNameCache = getFreshCache(nameCache, queryKey);
    if (fromNameCache !== null) {
        setCache(queryCache, queryKey, fromNameCache);
        return fromNameCache;
    }

    if (inFlight.has(queryKey)) {
        return inFlight.get(queryKey);
    }

    const request = (async () => {
        try {
            const { data } = await axios.get(`${GENSHIN_DB_BASE}/characters`, {
                timeout: 12_000,
                headers: {
                    'User-Agent': 'MoxiBot/1.0 (+https://github.com/MoxiLab/moxiBot)',
                },
                params: {
                    query: rawQuery,
                    resultLanguage: 'spanish',
                    matchNames: true,
                    matchAltNames: true,
                    matchAliases: true,
                },
            });

            const meta = toCharacterMeta(data);
            setCache(queryCache, queryKey, meta);

            if (meta) {
                const canonicalKey = normalizeCharacterKey(meta.name);
                if (canonicalKey) setCache(nameCache, canonicalKey, meta);
            }

            return meta;
        } catch {
            setCache(queryCache, queryKey, null);
            return null;
        } finally {
            inFlight.delete(queryKey);
        }
    })();

    inFlight.set(queryKey, request);
    return request;
}

async function resolveCharacterMetaList(list) {
    const names = Array.isArray(list) ? list : [];
    const unique = [];
    const seen = new Set();

    for (const name of names) {
        const key = normalizeCharacterKey(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(String(name));
    }

    const pairs = await Promise.all(unique.map(async (name) => {
        const meta = await fetchCharacterByQuery(name);
        return { name, meta };
    }));

    const map = new Map();
    for (const row of pairs) {
        const inputKey = normalizeCharacterKey(row.name);
        if (inputKey && row.meta) map.set(inputKey, row.meta);

        const canonicalKey = normalizeCharacterKey(row?.meta?.name);
        if (canonicalKey && row.meta) map.set(canonicalKey, row.meta);
    }

    return map;
}

async function fetchCategoryByQuery(folder, query, options = {}) {
    const safeFolder = String(folder || '').trim().toLowerCase();
    const rawQuery = String(query || '').trim();
    const queryKey = normalizeCharacterKey(rawQuery);
    if (!safeFolder || !queryKey) return null;

    const cacheKey = `${safeFolder}:${queryKey}`;
    const fromCache = getFreshCache(genericCache, cacheKey);
    if (fromCache !== null) return fromCache;

    const inFlightKey = `generic:${cacheKey}`;
    if (inFlight.has(inFlightKey)) {
        return inFlight.get(inFlightKey);
    }

    const request = (async () => {
        try {
            const { data } = await axios.get(`${GENSHIN_DB_BASE}/${safeFolder}`, {
                timeout: 12_000,
                headers: {
                    'User-Agent': 'MoxiBot/1.0 (+https://github.com/MoxiLab/moxiBot)',
                },
                params: {
                    query: rawQuery,
                    resultLanguage: 'spanish',
                    matchNames: true,
                    matchAltNames: true,
                    matchAliases: true,
                    ...options,
                },
            });

            const row = data && typeof data === 'object' ? data : null;
            setCache(genericCache, cacheKey, row);
            return row;
        } catch {
            setCache(genericCache, cacheKey, null);
            return null;
        } finally {
            inFlight.delete(inFlightKey);
        }
    })();

    inFlight.set(inFlightKey, request);
    return request;
}

async function getGenshinConfig() {
    const now = Date.now();
    if (configCache && (now - configCacheAt) < CACHE_TTL_MS) {
        return configCache;
    }

    try {
        const { data } = await axios.get(`${GENSHIN_DB_BASE}/config`, {
            timeout: 15_000,
            headers: {
                'User-Agent': 'MoxiBot/1.0 (+https://github.com/MoxiLab/moxiBot)',
            },
            params: {
                resultLanguage: 'spanish',
            },
        });

        configCache = data && typeof data === 'object' ? data : null;
        configCacheAt = now;
        return configCache;
    } catch {
        return configCache;
    }
}

module.exports = {
    fetchCharacterByQuery,
    resolveCharacterMetaList,
    fetchCategoryByQuery,
    getGenshinConfig,
};
