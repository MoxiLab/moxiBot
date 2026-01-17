const { getItemById } = require('./inventoryCatalog');
const { formatDuration } = require('./economyCore');

function isEggItemId(itemId) {
    const id = String(itemId || '').trim();
    return id.startsWith('mascotas/huevo-');
}

function hatchMsFromRarity(rarity) {
    const r = String(rarity || '').trim().toLowerCase();
    if (r === 'divine' || r === 'divino') return 8 * 60 * 60 * 1000;
    if (r === 'mythic' || r === 'mitico' || r === 'mítico') return 5 * 60 * 60 * 1000;
    if (r === 'legendary' || r === 'legendario') return 3 * 60 * 60 * 1000;
    if (r === 'epic' || r === 'epico' || r === 'épico') return 90 * 60 * 1000;
    if (r === 'rare' || r === 'raro') return 45 * 60 * 1000;
    if (r === 'uncommon' || r === 'poco-comun' || r === 'poco común') return 25 * 60 * 1000;
    return 15 * 60 * 1000; // common/default
}

function pickFirstOwnedEgg(eco) {
    const inv = Array.isArray(eco?.inventory) ? eco.inventory : [];
    const row = inv.find(r => r && isEggItemId(r.itemId) && Number(r.amount) > 0);
    return row ? String(row.itemId) : null;
}

function hasInventoryItem(eco, itemId, amount = 1) {
    const inv = Array.isArray(eco?.inventory) ? eco.inventory : [];
    const row = inv.find(r => r && String(r.itemId) === String(itemId));
    const have = row ? Math.max(0, Number(row.amount) || 0) : 0;
    return have >= Math.max(1, Math.trunc(Number(amount) || 1));
}

function consumeFromInventory(eco, itemId, amount = 1) {
    const want = Math.max(1, Math.trunc(Number(amount) || 1));
    const inv = Array.isArray(eco?.inventory) ? eco.inventory : [];
    const row = inv.find(r => r && String(r.itemId) === String(itemId));
    const have = row ? Math.max(0, Number(row.amount) || 0) : 0;
    if (!row || have < want) {
        const err = new Error('NOT_ENOUGH');
        err.code = have <= 0 ? 'NOT_OWNED' : 'NOT_ENOUGH';
        err.have = have;
        err.wanted = want;
        throw err;
    }

    row.amount = have - want;
    if (row.amount <= 0) {
        eco.inventory = inv.filter(r => r && String(r.itemId) !== String(itemId));
    } else {
        eco.inventory = inv;
    }

    return { consumed: want, remaining: Math.max(0, row.amount || 0) };
}

function startIncubation({ eco, eggItemId, now = Date.now(), lang } = {}) {
    if (!eco) throw new Error('Missing economy doc');
    if (!isEggItemId(eggItemId)) {
        const err = new Error('INVALID_EGG');
        err.code = 'INVALID_EGG';
        throw err;
    }

    const egg = getItemById(eggItemId, { lang });
    const hatchMs = hatchMsFromRarity(egg?.rarity);

    const startedAt = new Date(now);
    const hatchAt = new Date(now + hatchMs);

    eco.petIncubation = {
        eggItemId: String(eggItemId),
        startedAt,
        hatchAt,
    };

    return {
        hatchMs,
        hatchAt,
        startedAt,
        egg,
    };
}

function isIncubationReady(incubation, now = Date.now()) {
    const hatchAt = incubation?.hatchAt ? new Date(incubation.hatchAt).getTime() : null;
    if (!hatchAt || !Number.isFinite(hatchAt)) return false;
    return now >= hatchAt;
}

function incubationRemainingMs(incubation, now = Date.now()) {
    const hatchAt = incubation?.hatchAt ? new Date(incubation.hatchAt).getTime() : null;
    if (!hatchAt || !Number.isFinite(hatchAt)) return null;
    return Math.max(0, hatchAt - now);
}

function formatRemaining(incubation, now = Date.now()) {
    const ms = incubationRemainingMs(incubation, now);
    if (ms === null) return null;
    return formatDuration(ms);
}

function buildPetFromEgg({ eggItemId, lang } = {}) {
    const egg = getItemById(eggItemId, { lang });
    const rarity = String(egg?.rarity || 'common').toLowerCase();

    const pools = {
        common: ['Mochi', 'Nina', 'Kumo'],
        uncommon: ['Yuki', 'Sora', 'Mika'],
        rare: ['Prisma', 'Astra', 'Kira'],
        epic: ['Noctis', 'Abyss', 'Umbra'],
        legendary: ['Solarius', 'Drakon', 'Nyx'],
        mythic: ['Eclipse', 'Seraph', 'Arcana'],
        divine: ['Auriel', 'Celestia', 'Orion'],
    };
    const pool = pools[rarity] || pools.common;
    const name = pool[Math.floor(Math.random() * pool.length)] || 'MoxiPet';

    return {
        petId: Date.now(),
        name,
        level: 1,
        attributes: {
            rarity,
            fromEgg: String(eggItemId),
        },
    };
}

module.exports = {
    isEggItemId,
    hatchMsFromRarity,
    pickFirstOwnedEgg,
    hasInventoryItem,
    consumeFromInventory,
    startIncubation,
    isIncubationReady,
    incubationRemainingMs,
    formatRemaining,
    buildPetFromEgg,
};
