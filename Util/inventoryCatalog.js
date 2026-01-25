const fs = require('fs');
const path = require('path');

const INVENTORY_I18N_DIR = path.join(process.cwd(), 'Languages');

function normalizeLang(lang) {
    return String(lang || '').trim();
}

function langBase(lang) {
    const l = normalizeLang(lang);
    if (!l) return '';
    const idx = l.indexOf('-');
    return idx > 0 ? l.slice(0, idx) : l;
}

// El catálogo del juego se construye desde Languages/<lang>/economy/items.json.
// Se conserva DEFAULT_CATALOG_PATH solo por compatibilidad (ya no se usa).
const DEFAULT_CATALOG_PATH = null;

const DEFAULT_MIN_ITEMS_PER_CATEGORY = (() => {
    // Antes el proyecto inflaba el catálogo (p.ej. ~600 por categoría -> ~7-8k items).
    // Mantener ese comportamiento por defecto para que el shop/bag tengan “muchos” ítems
    // aunque economy/items.json solo defina los textos reales.
    const raw = process.env.INVENTORY_MIN_ITEMS_PER_CATEGORY;
    if (raw == null || String(raw).trim() === '') return 600;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 600;
})();

// Cachea archivos individuales por idioma (no por idioma solicitado)
let _inventoryLocaleFileCache = new Map();
// Cachea la cadena de fallbacks por idioma solicitado
let _inventoryLocaleChainCache = new Map();

function safeJsonRead(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const raw = stripBom(fs.readFileSync(filePath, 'utf8'));
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function getInventoryLocaleData(lang) {
    const l = normalizeLang(lang);
    if (!l) return null;
    if (_inventoryLocaleFileCache.has(l)) return _inventoryLocaleFileCache.get(l);

    // Nuevo: Languages/<lang>/economy/items.json
    // Compat: Languages/<lang>/economy/inventory/items.json (ruta anterior)
    // Compat legacy: Languages/<lang>/inventory/items.json
    const fpNew = path.join(INVENTORY_I18N_DIR, l, 'economy', 'items.json');
    const fpPrev = path.join(INVENTORY_I18N_DIR, l, 'economy', 'inventory', 'items.json');
    const fpOld = path.join(INVENTORY_I18N_DIR, l, 'inventory', 'items.json');

    const data = safeJsonRead(fpNew) || safeJsonRead(fpPrev) || safeJsonRead(fpOld);
    const out = data && typeof data === 'object' ? data : null;
    _inventoryLocaleFileCache.set(l, out);
    return out;
}

function getInventoryLocaleChain(lang) {
    const requested = normalizeLang(lang) || (process.env.DEFAULT_LANG || 'es-ES');
    if (_inventoryLocaleChainCache.has(requested)) return _inventoryLocaleChainCache.get(requested);

    const base = langBase(requested);
    const defaultLang = normalizeLang(process.env.DEFAULT_LANG) || 'es-ES';
    const candidates = [requested];
    if (base && base !== requested) candidates.push(base);
    candidates.push('en-US');
    candidates.push(defaultLang);

    const seen = new Set();
    const chain = [];
    for (const cand of candidates) {
        const c = normalizeLang(cand);
        if(c && !seen.has(c)) {
            seen.add(c);
            const data = getInventoryLocaleData(c);
            if (data) chain.push({ lang: c, data });
        }
    }

    _inventoryLocaleChainCache.set(requested, chain);
    return chain;
}

function getInventoryLocale(lang) {
    // Compat: devuelve el primer locale existente según la cadena
    const chain = getInventoryLocaleChain(lang);
    return chain.length ? chain[0].data : null;
}

function resolveLocalizedString(value, lang, { fallbackLang = 'es-ES' } = {}) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';

    const l = normalizeLang(lang);
    const base = langBase(lang);

    // Preferencias: exacto -> base -> fallback -> en-US -> primer string
    const candidates = [];
    if (l) candidates.push(l);
    if (base && base !== l) candidates.push(base);
    if (fallbackLang) candidates.push(String(fallbackLang));
    candidates.push('en-US');

    for (const k of candidates) {
        const v = value?.[k];
        if (typeof v === 'string' && v.trim()) return v;
    }

    for (const v of Object.values(value)) {
        if (typeof v === 'string' && v.trim()) return v;
    }

    return '';
}

function resolveItemTextFromLanguages(itemId, lang) {
    const id = String(itemId || '');
    if (!id) return null;

    const chain = getInventoryLocaleChain(lang);
    for (const { data } of chain) {
        const entry = data?.items?.[id];
        if (entry && typeof entry === 'object') {
            const name = typeof entry.name === 'string' ? entry.name : '';
            const description = typeof entry.description === 'string' ? entry.description : '';
            if (name || description) return { name, description };
        }
    }

    return null;
}

function resolveCategoryFromLanguages(categoryLabel, lang) {
    const label = String(categoryLabel || '');
    if (!label) return '';

    const chain = getInventoryLocaleChain(lang);
    for (const { data } of chain) {
        const translated = data?.categories?.[label];
        if (typeof translated === 'string' && translated.trim()) return translated;
    }

    return '';
}

function normalizeItemForLang(item, lang) {
    if (!item || typeof item !== 'object') return item;

    // Prioridad (opción 2): Languages/<lang>/economy/items.json por itemId
    const fromLang = resolveItemTextFromLanguages(item.id, lang);
    const name = fromLang?.name || resolveLocalizedString(item.name, lang);
    const description = fromLang?.description || resolveLocalizedString(item.description, lang);

    const safeName =
        name ||
        (typeof item.name === 'string' ? item.name : '') ||
        (item.id ? String(item.id) : '');

    return {
        ...item,
        name: safeName,
        description: description || (typeof item.description === 'string' ? item.description : ''),
    };
}

function stripBom(text) {
    return typeof text === 'string' ? text.replace(/^\uFEFF/, '') : text;
}

function slugify(input) {
    return String(input || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function pickPrefixFromCategory(cat) {
    const items = Array.isArray(cat?.items) ? cat.items : [];
    for (const it of items) {
        const id = String(it?.id || '');
        const slash = id.indexOf('/');
        if (slash > 0) return id.slice(0, slash);
    }
    const label =
        (typeof cat?.categoryKey === 'string' && cat.categoryKey.trim() ? cat.categoryKey : null) ||
        (typeof cat?.category === 'string' ? cat.category : 'categoria');
    return slugify(label) || 'categoria';
}

const CATEGORY_KEY_BY_PREFIX = {
    buffs: 'Buffs',
    coleccionables: 'Collectibles',
    consumibles: 'Consumables',
    herramientas: 'Tools',
    llaves: 'Keys',
    loots: 'Loot',
    mascotas: 'Pets',
    materiales: 'Materials',
    mejoras: 'Upgrades',
    misiones: 'Quests',
    pociones: 'Potions',
    rollos: 'Scrolls',
    proteccion: 'Protection',
};

const CATEGORY_ORDER = [
    'Buffs',
    'Collectibles',
    'Consumables',
    'Tools',
    'Keys',
    'Loot',
    'Pets',
    'Materials',
    'Upgrades',
    'Quests',
    'Potions',
    'Scrolls',
    'Protection',
    'Other',
];

function categoryKeyFromItemId(itemId) {
    const id = String(itemId || '');
    const prefix = id.includes('/') ? id.slice(0, id.indexOf('/')) : id;
    return CATEGORY_KEY_BY_PREFIX[prefix] || 'Other';
}

function getBaseItemsData({ lang } = {}) {
    const requested = normalizeLang(lang) || normalizeLang(process.env.DEFAULT_LANG) || 'es-ES';
    const base = langBase(requested);
    const defaultLang = normalizeLang(process.env.DEFAULT_LANG) || 'es-ES';

    const candidates = [requested];
    if (base && base !== requested) candidates.push(base);
    candidates.push('en-US');
    candidates.push(defaultLang);

    const seen = new Set();
    for (const cand of candidates) {
        const c = normalizeLang(cand);
        if(c && !seen.has(c)) {
            seen.add(c);
            const data = getInventoryLocaleData(c);
            if (data && data.items && typeof data.items === 'object') return data;
        }
    }
    return null;
}

function hash01(input) {
    // Hash simple determinista (no criptográfico) para asignar rareza/precio sin archivos extra.
    const s = String(input || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    const u = (h >>> 0) / 0xffffffff;
    return Number.isFinite(u) ? u : 0;
}

function rarityForItemId(itemId) {
    const r = hash01(itemId);
    if (r < 0.01) return 'legendary';
    if (r < 0.04) return 'epic';
    if (r < 0.12) return 'rare';
    if (r < 0.30) return 'uncommon';
    return 'common';
}

function prettyNameFromItemId(itemId) {
    const id = String(itemId || '');
    if (!id) return '';
    const last = id.includes('/') ? id.slice(id.indexOf('/') + 1) : id;
    return last
        .split('-')
        .filter(Boolean)
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ');
}

function rarityForIndex(i) {
    // Distribución simple y determinista (sirve para “relleno” de catálogo)
    if (i % 200 === 0) return 'legendary';
    if (i % 80 === 0) return 'epic';
    if (i % 25 === 0) return 'rare';
    if (i % 8 === 0) return 'uncommon';
    return 'common';
}

function basePriceForPrefix(prefix) {
    if (prefix === 'materiales') {
        return 12;
    } else if (prefix === 'consumibles') {
        return 30;
    } else if (prefix === 'coleccionables') {
        return 80;
    } else if (prefix === 'buffs') {
        return 250;
    } else if (prefix === 'herramientas') {
        return 220;
    } else if (prefix === 'llaves') {
        return 900;
    } else if (prefix === 'loots') {
        return 600;
    } else if (prefix === 'mascotas') {
        return 900;
    } else if (prefix === 'mejoras') {
        return 1500;
    } else if (prefix === 'pociones') {
        return 180;
    } else if (prefix === 'rollos') {
        return 220;
    } else if (prefix === 'proteccion') {
        return 2500;
    } else if (prefix === 'misiones') {
        return 200;
    }
    return 100;
}

function priceForRarity(base, rarity) {
    if (rarity === 'uncommon') {
        return Math.max(1, Math.trunc(base * 1.6));
    } else if (rarity === 'rare') {
        return Math.max(1, Math.trunc(base * 3.6));
    } else if (rarity === 'epic') {
        return Math.max(1, Math.trunc(base * 7.0));
    } else if (rarity === 'legendary') {
        return Math.max(1, Math.trunc(base * 12.0));
    }
    return Math.max(1, Math.trunc(base));
}

function expandCatalogToMinItems(catalog, minPerCategory) {
    const min = Number.isFinite(minPerCategory) ? Math.max(0, Math.trunc(minPerCategory)) : 0;
    if (!min) return catalog;
    if (!Array.isArray(catalog)) return catalog;

    const usedIds = new Set();
    for (const cat of catalog) {
        const items = Array.isArray(cat?.items) ? cat.items : [];
        for (const it of items) {
            if (it?.id) usedIds.add(String(it.id));
        }
    }

    for (const cat of catalog) {
        if(cat && typeof cat === 'object') {
            if (!Array.isArray(cat.items)) cat.items = [];

            const prefix = pickPrefixFromCategory(cat);
            const basePrice = basePriceForPrefix(prefix);
            const label = typeof cat.category === 'string' ? cat.category : prefix;
            const safeLabel = label || prefix;

            let counter = 1;
            while (cat.items.length < min) {
                const rarity = rarityForIndex(counter);
                const id = `${prefix}/auto-${String(counter).padStart(4, '0')}`;
                counter += 1;
                if(!usedIds.has(id)) {
                    usedIds.add(id);

                    cat.items.push({
                        id,
                        name: {
                            'es-ES': `${safeLabel} (Auto) ${id.slice(id.lastIndexOf('-') + 1)}`,
                            'en-US': `${safeLabel} (Auto) ${id.slice(id.lastIndexOf('-') + 1)}`,
                        },
                        description: {
                            'es-ES': 'Ítem autogenerado para ampliar el catálogo.',
                            'en-US': 'Auto-generated item to expand the catalog.',
                        },
                        rarity,
                        price: priceForRarity(basePrice, rarity),
                    });
                }
            }
        }
    }

    return catalog;
}

function loadCatalog(arg = undefined) {
    // Compat: antes recibía catalogPath. Ahora se ignora.
    const lang = (arg && typeof arg === 'object' && arg.lang) ? arg.lang : (process.env.DEFAULT_LANG || 'es-ES');
    const baseData = getBaseItemsData({ lang }) || { categories: {}, items: {} };
    const itemsObj = baseData?.items && typeof baseData.items === 'object' ? baseData.items : {};

    const categories = new Map();
    const ensureCategory = (categoryKey) => {
        if (!categories.has(categoryKey)) {
            categories.set(categoryKey, {
                categoryKey,
                category: categoryKey,
                label: categoryKey,
                items: [],
            });
        }
        return categories.get(categoryKey);
    };

    for (const itemId of Object.keys(itemsObj)) {
        const categoryKey = categoryKeyFromItemId(itemId);
        const cat = ensureCategory(categoryKey);
        const prefix = String(itemId).includes('/') ? String(itemId).slice(0, String(itemId).indexOf('/')) : String(itemId);
        const basePrice = basePriceForPrefix(prefix);
        const rarity = rarityForItemId(itemId);
        cat.items.push({
            id: itemId,
            // name/description reales se resuelven por normalizeItemForLang() desde items.json
            name: itemId,
            description: '',
            rarity,
            price: priceForRarity(basePrice, rarity),
        });
    }

    // Orden estable por categorías conocidas
    const out = [];
    for (const key of CATEGORY_ORDER) {
        if (categories.has(key)) out.push(categories.get(key));
    }
    // Por si apareciese alguna categoría no contemplada
    for (const [key, cat] of categories.entries()) {
        if (!CATEGORY_ORDER.includes(key)) out.push(cat);
    }

    return expandCatalogToMinItems(out, DEFAULT_MIN_ITEMS_PER_CATEGORY);
}

function buildItemIndex(catalog) {
    const byId = new Map();
    for (const cat of catalog) {
        const items = Array.isArray(cat?.items) ? cat.items : [];
        for (const item of items) {
            if(item && item.id) byId.set(item.id, item);
        }
    }
    return { byId };
}

function getItemById(itemId, { catalogPath, lang } = {}) {
    const catalog = loadCatalog({ lang: lang || process.env.DEFAULT_LANG || 'es-ES' });
    const { byId } = buildItemIndex(catalog);
    const item = byId.get(itemId) || null;

    // Si el itemId no está en economy/items.json (o no entró al catálogo), devolvemos un ítem
    // sintético para evitar “faltan items” / crashes.
    if (!item) {
        const effectiveLang = lang || process.env.DEFAULT_LANG || 'es-ES';
        const fromLang = resolveItemTextFromLanguages(itemId, effectiveLang);
        const prefix = String(itemId || '').includes('/') ? String(itemId).split('/')[0] : 'other';
        const rarity = rarityForItemId(itemId);
        return {
            id: String(itemId),
            name: (fromLang?.name || '').trim() || prettyNameFromItemId(itemId) || String(itemId),
            description: (fromLang?.description || '').trim(),
            rarity,
            price: priceForRarity(basePriceForPrefix(prefix), rarity),
        };
    }

    // Importante: devolvemos name/description como string aunque en JSON sean objetos.
    return normalizeItemForLang(item, lang || process.env.DEFAULT_LANG || 'es-ES');
}

function assertValidItemId(itemId, { catalogPath } = {}) {
    const item = getItemById(itemId, { catalogPath });
    if (!item) {
        const err = new Error(`Unknown itemId: ${itemId}`);
        err.code = 'UNKNOWN_ITEM_ID';
        throw err;
    }
    return item;
}

module.exports = {
    DEFAULT_CATALOG_PATH,
    loadCatalog,
    buildItemIndex,
    getItemById,
    assertValidItemId,
    resolveLocalizedString,
    normalizeItemForLang,
    getInventoryLocale,
    resolveItemTextFromLanguages,
    resolveCategoryFromLanguages,
};
