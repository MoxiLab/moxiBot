const axios = require('axios');
const { normalizeCharacterKey } = require('./genshinRoster');

const GENSHIN_DB_BASE = 'https://genshin-db-api.vercel.app/api/v5';

function buildEnkaImageFromFile(fileName) {
    const clean = String(fileName || '').trim();
    if (!clean) return null;
    return `https://enka.network/ui/${clean}.png`;
}

function toCharacterMeta(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name || '').trim();
    if (!name) return null;

    const images = raw.images && typeof raw.images === 'object' ? raw.images : {};
    return {
        id: raw.id ? String(raw.id) : null,
        name,
        rarity: raw.rarity ? `${Number(raw.rarity) || 0}★` : 'N/D',
        element: String(raw.elementText || '').trim() || 'N/D',
        weaponType: String(raw.weaponText || '').trim() || 'N/D',
        imageUrl: images.mihoyo_sideIcon || images.hoyowiki_icon || buildEnkaImageFromFile(images.filename_sideIcon),
        cardImageUrl: images.mihoyo_icon || buildEnkaImageFromFile(images.filename_gachaSlice),
        fullImageUrl: buildEnkaImageFromFile(images.filename_gachaSplash),
        source: 'genshin-db-proxy',
    };
}

async function apiGet(pathname, query) {
    const { data } = await axios.get(`${GENSHIN_DB_BASE}/${pathname}`, {
        timeout: 12_000,
        headers: {
            'User-Agent': 'MoxiBot/1.0 (+https://github.com/MoxiLab/moxiBot)',
        },
        params: {
            resultLanguage: 'spanish',
            matchNames: true,
            matchAltNames: true,
            matchAliases: true,
            ...query,
        },
    });
    return data && typeof data === 'object' ? data : null;
}

const fallbackImpl = {
    async fetchCharacterByQuery(query) {
        const q = String(query || '').trim();
        if (!normalizeCharacterKey(q)) return null;
        try {
            const data = await apiGet('characters', { query: q });
            return toCharacterMeta(data);
        } catch {
            return null;
        }
    },

    async resolveCharacterMetaList(list) {
        const names = Array.isArray(list) ? list : [];
        const map = new Map();
        for (const name of names) {
            const meta = await this.fetchCharacterByQuery(name);
            const inputKey = normalizeCharacterKey(name);
            const canonicalKey = normalizeCharacterKey(meta?.name || '');
            if (inputKey && meta) map.set(inputKey, meta);
            if (canonicalKey && meta) map.set(canonicalKey, meta);
        }
        return map;
    },

    async fetchCategoryByQuery(folder, query, options = {}) {
        const f = String(folder || '').trim();
        const q = String(query || '').trim();
        if (!f || !normalizeCharacterKey(q)) return null;
        try {
            let result = await apiGet(f, { query: q, ...options });
            if (result && typeof result === 'object' && Object.keys(result).length > 0) {
                return result;
            }

            const axios = require('axios');
            try {
                const { data } = await axios.get(`${GENSHIN_DB_BASE}/${f}`, {
                    timeout: 12_000,
                    headers: {
                        'User-Agent': 'MoxiBot/1.0 (+https://github.com/MoxiLab/moxiBot)',
                    },
                    params: {
                        query: q,
                        matchNames: true,
                        matchAltNames: true,
                        matchAliases: true,
                        ...options,
                    },
                });
                return data && typeof data === 'object' ? data : null;
            } catch {
                return result;
            }
        } catch {
            return null;
        }
    },

    async getGenshinConfig() {
        try {
            return await apiGet('config', {});
        } catch {
            return null;
        }
    },
};

function loadPrimary() {
    try {
        return require('./genshinDb');
    } catch {
        try {
            const legacyPath = './' + 'genshindb';
            return require(legacyPath);
        } catch {
            return fallbackImpl;
        }
    }
}

module.exports = loadPrimary();
