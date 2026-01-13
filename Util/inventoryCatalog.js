const fs = require('fs');
const path = require('path');

const DEFAULT_CATALOG_PATH = path.join(process.cwd(), 'Models', 'InventoryItems.json');

function stripBom(text) {
    return typeof text === 'string' ? text.replace(/^\uFEFF/, '') : text;
}

function loadCatalog(catalogPath = DEFAULT_CATALOG_PATH) {
    const raw = stripBom(fs.readFileSync(catalogPath, 'utf8'));
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
        throw new Error('InventoryItems.json must be an array of categories');
    }
    return data;
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

function getItemById(itemId, { catalogPath } = {}) {
    const catalog = loadCatalog(catalogPath);
    const { byId } = buildItemIndex(catalog);
    return byId.get(itemId) || null;
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
};
