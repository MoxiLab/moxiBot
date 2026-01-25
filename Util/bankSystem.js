function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function formatInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return Math.trunc(x).toLocaleString('en-US');
}

function getBankBaseCapacity() {
    const raw = Number(process.env.BANK_BASE_CAPACITY);
    return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 50_000;
}

function getBankCapacityPerLevel() {
    const raw = Number(process.env.BANK_CAPACITY_PER_LEVEL);
    return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 25_000;
}

function getBankUpgradeBaseCost() {
    const raw = Number(process.env.BANK_UPGRADE_BASE_COST);
    return Number.isFinite(raw) ? Math.max(1, Math.trunc(raw)) : 15_000;
}

function getBankUpgradeGrowth() {
    const raw = Number(process.env.BANK_UPGRADE_GROWTH);
    return Number.isFinite(raw) ? Math.max(1.01, raw) : 1.5;
}

function getBankCapacity(level) {
    const lv = Math.max(0, safeInt(level, 0));
    return getBankBaseCapacity() + (lv * getBankCapacityPerLevel());
}

function getBankUpgradeCost(level) {
    const lv = Math.max(0, safeInt(level, 0));
    const cost = getBankUpgradeBaseCost() * Math.pow(getBankUpgradeGrowth(), lv);
    return Math.max(1, Math.trunc(cost));
}

const BANK_UPGRADE_ITEM_ID = 'mejoras/expansion-de-banco';

function getBankUpgradeTotalCost(level, amount) {
    const lv = Math.max(0, safeInt(level, 0));
    const qty = Math.max(1, safeInt(amount, 1));
    let total = 0;
    for (let i = 0; i < qty; i += 1) {
        total += getBankUpgradeCost(lv + i);
    }
    return Math.max(1, Math.trunc(total));
}

function getBankInfo(eco) {
    const level = Math.max(0, safeInt(eco?.bankLevel, 0));
    const capacity = getBankCapacity(level);
    const nextCost = getBankUpgradeCost(level);
    const bank = Math.max(0, safeInt(eco?.bank, 0));
    const free = Math.max(0, capacity - bank);
    return { level, capacity, nextCost, bank, free };
}

module.exports = {
    safeInt,
    formatInt,
    BANK_UPGRADE_ITEM_ID,
    getBankCapacity,
    getBankUpgradeCost,
    getBankUpgradeTotalCost,
    getBankInfo,
};
