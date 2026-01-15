const { UserEconomy } = require('../Models/EconomySchema');
const { getItemById } = require('./inventoryCatalog');
const { rollWork } = require('./workJobs');

function nowMs() {
    return Date.now();
}

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function msToHuman(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m <= 0) return `${r}s`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h <= 0) return `${mm}m ${r}s`;
    return `${h}h ${mm}m`;
}

async function ensureMongoIfConfigured() {
    if (typeof process.env.MONGODB === 'string' && process.env.MONGODB.trim()) {
        // eslint-disable-next-line global-require
        const { ensureMongoConnection } = require('./mongoConnect');
        await ensureMongoConnection();
    }
}

function getWorkCooldownMs() {
    const minutes = Number(process.env.WORK_COOLDOWN_MINUTES || 30);
    if (!Number.isFinite(minutes) || minutes <= 0) return 30 * 60 * 1000;
    return Math.round(minutes * 60 * 1000);
}

function addInventoryItem(inv, itemId, amount) {
    const qty = Math.max(1, safeInt(amount, 1));
    const rows = Array.isArray(inv) ? inv : [];
    const existing = rows.find((x) => x && x.itemId === itemId);
    if (existing) {
        existing.amount = safeInt(existing.amount, 0) + qty;
    } else {
        rows.push({ itemId, amount: qty, obtainedAt: new Date() });
    }
    return rows;
}

async function doWork({ userId, jobKey }) {
    if (!userId) {
        const err = new Error('Missing userId');
        err.code = 'BAD_INPUT';
        throw err;
    }

    await ensureMongoIfConfigured();

    let eco = await UserEconomy.findOne({ userId });
    if (!eco) eco = await UserEconomy.create({ userId, balance: 0, inventory: [] });

    const cooldownMs = getWorkCooldownMs();
    const last = eco.lastWork ? new Date(eco.lastWork).getTime() : 0;
    const nextOkAt = last + cooldownMs;

    if (last && nowMs() < nextOkAt) {
        const err = new Error('COOLDOWN');
        err.code = 'COOLDOWN';
        err.retryAfterMs = nextOkAt - nowMs();
        return { ok: false, err, cooldownMs };
    }

    const roll = rollWork(jobKey);
    if (!roll) {
        const err = new Error('UNKNOWN_JOB');
        err.code = 'UNKNOWN_JOB';
        return { ok: false, err, cooldownMs };
    }

    eco.balance = safeInt(eco.balance, 0) + safeInt(roll.coins, 0);

    let itemName = null;
    if (roll.itemId && roll.itemAmount > 0) {
        eco.inventory = addInventoryItem(eco.inventory, roll.itemId, roll.itemAmount);
        const item = getItemById(roll.itemId);
        itemName = item?.name || roll.itemId;
    }

    eco.lastWork = new Date();
    await eco.save();

    return {
        ok: true,
        cooldownMs,
        result: {
            ...roll,
            itemName,
        },
    };
}

module.exports = {
    getWorkCooldownMs,
    msToHuman,
    doWork,
};
