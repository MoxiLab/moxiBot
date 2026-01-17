const fs = require('fs');
const path = require('path');

const DEFAULT_CATALOG_PATH = path.join(process.cwd(), 'Models', 'InventoryItems.json');
const INVENTORY_I18N_DIR = path.join(process.cwd(), 'Languages');

const DEFAULT_MIN_ITEMS_PER_CATEGORY = (() => {
    const raw = process.env.INVENTORY_MIN_ITEMS_PER_CATEGORY;
    if (raw == null || String(raw).trim() === '') return 600;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 600;
})();

let _inventoryLocaleCache = new Map();

function safeJsonRead(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const raw = stripBom(fs.readFileSync(filePath, 'utf8'));
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function getInventoryLocale(lang) {
    const l = normalizeLang(lang) || (process.env.DEFAULT_LANG || 'es-ES');
    if (_inventoryLocaleCache.has(l)) return _inventoryLocaleCache.get(l);

    const base = langBase(l);
    const candidates = [l];
    if (base && base !== l) candidates.push(base);
    candidates.push(process.env.DEFAULT_LANG || 'es-ES');
    candidates.push('en-US');

    for (const cand of candidates) {
        const fp = path.join(INVENTORY_I18N_DIR, cand, 'inventory', 'items.json');
        const data = safeJsonRead(fp);
        if (data && typeof data === 'object') {
            _inventoryLocaleCache.set(l, data);
            return data;
        }
    }

    _inventoryLocaleCache.set(l, null);
    return null;
}

function normalizeLang(lang) {
    return String(lang || '').trim();
}

function langBase(lang) {
    const l = normalizeLang(lang);
    if (!l) return '';
    const idx = l.indexOf('-');
    return idx > 0 ? l.slice(0, idx) : l;
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
    const locale = getInventoryLocale(lang);
    const entry = locale?.items?.[String(itemId || '')];
    if (!entry || typeof entry !== 'object') return null;
    const name = typeof entry.name === 'string' ? entry.name : '';
    const description = typeof entry.description === 'string' ? entry.description : '';
    return { name, description };
}

function resolveCategoryFromLanguages(categoryLabel, lang) {
    const locale = getInventoryLocale(lang);
    const label = String(categoryLabel || '');
    const translated = locale?.categories?.[label];
    return typeof translated === 'string' && translated.trim() ? translated : '';
}

function normalizeItemForLang(item, lang) {
    if (!item || typeof item !== 'object') return item;

    // Prioridad (opción 2): Languages/<lang>/inventory/items.json por itemId
    const fromLang = resolveItemTextFromLanguages(item.id, lang);
    const name = fromLang?.name || resolveLocalizedString(item.name, lang);
    const description = fromLang?.description || resolveLocalizedString(item.description, lang);

    return {
        ...item,
        name: name || (typeof item.name === 'string' ? item.name : ''),
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
    const label = typeof cat?.category === 'string' ? cat.category : 'categoria';
    return slugify(label) || 'categoria';
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
    switch (prefix) {
        case 'materiales':
            return 12;
        case 'consumibles':
            return 30;
        case 'coleccionables':
            return 80;
        case 'buffs':
            return 250;
        case 'herramientas':
            return 220;
        case 'llaves':
            return 900;
        case 'loots':
            return 600;
        case 'mascotas':
            return 900;
        case 'mejoras':
            return 1500;
        case 'pociones':
            return 180;
        case 'rollos':
            return 220;
        case 'proteccion':
            return 2500;
        case 'misiones':
            return 200;
        default:
            return 100;
    }
}

function priceForRarity(base, rarity) {
    switch (rarity) {
        case 'uncommon':
            return Math.max(1, Math.trunc(base * 1.6));
        case 'rare':
            return Math.max(1, Math.trunc(base * 3.6));
        case 'epic':
            return Math.max(1, Math.trunc(base * 7.0));
        case 'legendary':
            return Math.max(1, Math.trunc(base * 12.0));
        case 'common':
        default:
            return Math.max(1, Math.trunc(base));
    }
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
        if (!cat || typeof cat !== 'object') continue;
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
            if (usedIds.has(id)) continue;
            usedIds.add(id);

            cat.items.push({
                id,
                name: `${safeLabel} (Auto) ${id.slice(id.lastIndexOf('-') + 1)}`,
                description: 'Ítem autogenerado para ampliar el catálogo.',
                rarity,
                price: priceForRarity(basePrice, rarity),
            });
        }
    }

    return catalog;
}

function loadCatalog(catalogPath = DEFAULT_CATALOG_PATH) {
    const raw = stripBom(fs.readFileSync(catalogPath, 'utf8'));
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
        throw new Error('InventoryItems.json must be an array of categories');
    }
    return expandCatalogToMinItems(data, DEFAULT_MIN_ITEMS_PER_CATEGORY);
}

function buildItemIndex(catalog) {
    const byId = new Map();
    for (const cat of catalog) {
        const items = Array.isArray(cat?.items) ? cat.items : [];
        for (const item of items) {
            if (!item?.id) continue;
            byId.set(item.id, item);
        }
    }
    return { byId };
}

function getItemById(itemId, { catalogPath, lang } = {}) {
    const catalog = loadCatalog(catalogPath);
    const { byId } = buildItemIndex(catalog);
    const item = byId.get(itemId) || null;
    // Importante: devolvemos name/description como string aunque en JSON sean objetos.
    return item ? normalizeItemForLang(item, lang || process.env.DEFAULT_LANG || 'es-ES') : null;
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
