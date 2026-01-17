const { UserEconomy } = require('../Models/EconomySchema');

function normalizeText(s) {
    return String(s || '')
        .trim()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
}

function isPositiveInt(n) {
    return Number.isInteger(n) && n > 0;
}

function resolveItemFromInput({ shopId, query } = {}) {
    // Lazy requires to reduce load + avoid cycles
    // eslint-disable-next-line global-require
    const { buildShopData } = require('./shopView');
    // eslint-disable-next-line global-require
    const { loadCatalog, buildItemIndex } = require('./inventoryCatalog');

    const { allItems, byShopId, byItemId } = buildShopData();

    if (isPositiveInt(shopId)) {
        const it = byShopId.get(shopId);
        if (!it) return null;
        return {
            itemId: it.itemId,
            name: it.name || it.itemId,
            shopId: it.shopId,
            description: it.description || '',
        };
    }

    const raw = String(query || '').trim();
    if (!raw) return null;

    // 1) Exact itemId match
    const exactByItemId = byItemId.get(raw);
    if (exactByItemId) {
        return {
            itemId: exactByItemId.itemId,
            name: exactByItemId.name || exactByItemId.itemId,
            shopId: exactByItemId.shopId,
            description: exactByItemId.description || '',
        };
    }

    // 2) Match by shop name (exact/contains)
    const needle = normalizeText(raw);
    const exactName = allItems.find((i) => normalizeText(i.name) === needle);
    if (exactName) {
        return {
            itemId: exactName.itemId,
            name: exactName.name || exactName.itemId,
            shopId: exactName.shopId,
            description: exactName.description || '',
        };
    }

    const containsName = allItems.find((i) => normalizeText(i.name).includes(needle));
    if (containsName) {
        return {
            itemId: containsName.itemId,
            name: containsName.name || containsName.itemId,
            shopId: containsName.shopId,
            description: containsName.description || '',
        };
    }

    // 3) Catalog name match (items that may not be in shop)
    const catalog = loadCatalog();
    const { byId } = buildItemIndex(catalog);

    for (const [itemId, item] of byId.entries()) {
        if (!item) continue;
        if (normalizeText(item.name) === needle) {
            return {
                itemId,
                name: item.name || itemId,
                shopId: null,
                description: item.description || '',
            };
        }
    }

    for (const [itemId, item] of byId.entries()) {
        if (!item) continue;
        if (normalizeText(item.name).includes(needle)) {
            return {
                itemId,
                name: item.name || itemId,
                shopId: null,
                description: item.description || '',
            };
        }
    }

    return null;
}

async function ensureEconomyUser(userId) {
    if (typeof process.env.MONGODB === 'string' && process.env.MONGODB.trim()) {
        // eslint-disable-next-line global-require
        const { ensureMongoConnection } = require('./mongoConnect');
        await ensureMongoConnection();
    }

    let eco = await UserEconomy.findOne({ userId });
    if (!eco) eco = await UserEconomy.create({ userId, balance: 0, bank: 0, sakuras: 0 });
    return eco;
}

async function consumeInventoryItem({ userId, itemId, amount = 1 } = {}) {
    if (!userId || !itemId) {
        const err = new Error('Missing userId or itemId');
        err.code = 'BAD_INPUT';
        throw err;
    }

    const qty = Number.isFinite(amount) ? Math.max(1, Math.trunc(amount)) : 1;

    const eco = await ensureEconomyUser(userId);
    const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
    const row = inv.find((x) => x && x.itemId === itemId);

    const have = row ? Math.max(0, Number(row.amount) || 0) : 0;
    if (!row || have <= 0) {
        const err = new Error('NOT_OWNED');
        err.code = 'NOT_OWNED';
        err.have = have;
        throw err;
    }

    if (qty > have) {
        const err = new Error('NOT_ENOUGH');
        err.code = 'NOT_ENOUGH';
        err.have = have;
        err.wanted = qty;
        throw err;
    }

    row.amount = have - qty;
    if (row.amount <= 0) {
        eco.inventory = inv.filter((x) => x && x.itemId !== itemId);
    } else {
        eco.inventory = inv;
    }

    await eco.save();

    return {
        consumed: qty,
        remaining: Math.max(0, row.amount || 0),
    };
}

module.exports = {
    resolveItemFromInput,
    consumeInventoryItem,
};
