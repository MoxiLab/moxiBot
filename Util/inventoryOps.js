function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function addToInventory(economyDoc, itemId, amount = 1) {
    const qty = Math.max(1, safeInt(amount, 1));
    const inv = Array.isArray(economyDoc?.inventory) ? economyDoc.inventory : [];

    const row = inv.find(x => x && x.itemId === itemId);
    if (row) row.amount = safeInt(row.amount, 0) + qty;
    else inv.push({ itemId, amount: qty, obtainedAt: new Date() });

    economyDoc.inventory = inv;
}

function addManyToInventory(economyDoc, items = []) {
    for (const it of Array.isArray(items) ? items : []) {
        if (!it?.itemId) continue;
        addToInventory(economyDoc, String(it.itemId), safeInt(it.amount, 1));
    }
}

module.exports = {
    addToInventory,
    addManyToInventory,
};
