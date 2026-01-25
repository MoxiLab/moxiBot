const { getItemById } = require('./inventoryCatalog');
const { formatDuration } = require('./economyCore');

function safeNumber(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return x;
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function getNeglectMs() {
    const raw = process.env.PET_NEGLECT_HOURS;
    const hours = safeNumber(raw, 48);
    return Math.max(1, hours) * 60 * 60 * 1000;
}

function ensurePetAttributes(pet, now = Date.now()) {
    if (!pet) return null;
    pet.attributes = pet.attributes && typeof pet.attributes === 'object' ? pet.attributes : {};
    const a = pet.attributes;

    const isNewborn = a.newborn === true;

    if (!a.createdAt) a.createdAt = new Date(now);
    if (!a.lastCareAt) a.lastCareAt = new Date(now);

    if (!a.care || typeof a.care !== 'object') {
        a.care = isNewborn
            ? { affection: 0, hunger: 0, hygiene: 0 }
            : { affection: 80, hunger: 80, hygiene: 80 };
    }

    // Decaimiento de cuidados con el tiempo (para que no estén siempre llenos)
    // Usamos un marcador independiente para no romper la lógica de "neglect" (lastCareAt).
    if (!a.careDecayAt) a.careDecayAt = new Date(now);
    const lastDecay = a.careDecayAt ? new Date(a.careDecayAt).getTime() : null;
    if (lastDecay && Number.isFinite(lastDecay) && now > lastDecay) {
        const elapsedMs = now - lastDecay;
        const hours = Math.floor(elapsedMs / (60 * 60 * 1000));
        if (hours > 0) {
            // Ritmo: hambre baja más rápido, luego higiene, luego cariño.
            a.care.hunger = safeNumber(a.care.hunger, 0) - (hours * 3);
            a.care.hygiene = safeNumber(a.care.hygiene, 0) - (hours * 2);
            a.care.affection = safeNumber(a.care.affection, 0) - (hours * 1);
            a.careDecayAt = new Date(now);
        }
    }

    if (!Number.isFinite(Number(a.care.affection))) a.care.affection = isNewborn ? 0 : 80;
    if (!Number.isFinite(Number(a.care.hunger))) a.care.hunger = isNewborn ? 0 : 80;
    if (!Number.isFinite(Number(a.care.hygiene))) a.care.hygiene = isNewborn ? 0 : 80;

    a.care.affection = clamp(Math.trunc(safeNumber(a.care.affection, 0)), 0, 100);
    a.care.hunger = clamp(Math.trunc(safeNumber(a.care.hunger, 0)), 0, 100);
    a.care.hygiene = clamp(Math.trunc(safeNumber(a.care.hygiene, 0)), 0, 100);

    if (!Number.isFinite(Number(a.xp))) a.xp = 0;
    if (!Number.isFinite(Number(a.stars))) a.stars = 0;

    a.xp = clamp(Math.trunc(safeNumber(a.xp, 0)), 0, 999999);
    a.stars = clamp(Math.trunc(safeNumber(a.stars, 0)), 0, 5);

    // Valor base para UI; se recalcula dinámicamente
    a.xpToNext = petXpToNext(pet);

    return pet;
}

function petXpToNext(pet) {
    const level = Math.max(1, Math.trunc(safeNumber(pet?.level, 1)));
    // Más difícil que antes (muchos niveles): curva lineal + cuadrática suave.
    // Nivel 1 => 120
    // Nivel 10 => ~552
    // Nivel 20 => ~1412
    const n = Math.max(0, level - 1);
    return 120 + (n * 30) + Math.floor((n * n) * 2);
}

function getActivePet(eco) {
    const pets = Array.isArray(eco?.pets) ? eco.pets : [];
    if (!pets.length) return null;
    return pets[pets.length - 1];
}

function isPetAway(pet) {
    const away = pet?.attributes?.away;
    return Boolean(away && typeof away === 'object');
}

function checkAndMarkPetAway(pet, now = Date.now()) {
    if (!pet) return { changed: false, away: false };
    ensurePetAttributes(pet, now);
    if (isPetAway(pet)) return { changed: false, away: true };

    const last = pet?.attributes?.lastCareAt ? new Date(pet.attributes.lastCareAt).getTime() : null;
    if (!last || !Number.isFinite(last)) return { changed: false, away: false };

    const neglectMs = getNeglectMs();
    if (now - last < neglectMs) return { changed: false, away: false };

    pet.attributes.away = {
        at: new Date(now),
        reason: 'neglect',
    };
    return { changed: true, away: true };
}

function returnPetFromAway(pet, now = Date.now()) {
    if (!pet) return false;
    ensurePetAttributes(pet, now);
    if (!isPetAway(pet)) return false;
    pet.attributes.away = null;
    pet.attributes.lastCareAt = new Date(now);

    // Pequeño “reset” amable
    pet.attributes.care.affection = clamp(pet.attributes.care.affection, 30, 100);
    pet.attributes.care.hunger = clamp(pet.attributes.care.hunger, 30, 100);
    pet.attributes.care.hygiene = clamp(pet.attributes.care.hygiene, 30, 100);
    return true;
}

function applyPetAction(pet, action, now = Date.now()) {
    if (!pet) return { changed: false, leveledUp: false, xpGained: 0 };
    ensurePetAttributes(pet, now);
    if (isPetAway(pet)) {
        const err = new Error('PET_AWAY');
        err.code = 'PET_AWAY';
        throw err;
    }

    const a = pet.attributes;
    const care = a.care;
    const before = {
        affection: care.affection,
        hunger: care.hunger,
        hygiene: care.hygiene,
        xp: a.xp,
        level: Math.max(1, Math.trunc(safeNumber(pet.level, 1))),
    };

    const act = String(action || '').trim().toLowerCase();

    const xpAwardedByAction = (act === 'play') ? 10
        : (act === 'feed' ? 6
            : (act === 'clean' ? 6
                : (act === 'train' ? 18 : 0)));

    if (act === 'play') {
        care.affection += 10;
        care.hunger -= 5;
        care.hygiene -= 2;
        a.xp += 10;
    } else if (act === 'feed') {
        care.hunger += 20;
        care.affection += 4;
        a.xp += 6;
    } else if (act === 'clean') {
        care.hygiene += 20;
        care.affection += 2;
        a.xp += 6;
    } else if (act === 'train') {
        a.xp += 18;
        care.affection -= 2;
        care.hunger -= 10;
        care.hygiene -= 8;
    } else {
        const err = new Error('INVALID_ACTION');
        err.code = 'INVALID_ACTION';
        throw err;
    }

    care.affection = clamp(Math.trunc(care.affection), 0, 100);
    care.hunger = clamp(Math.trunc(care.hunger), 0, 100);
    care.hygiene = clamp(Math.trunc(care.hygiene), 0, 100);
    a.xp = clamp(Math.trunc(a.xp), 0, 999999);
    a.lastCareAt = new Date(now);

    // Al primer cuidado, deja de ser "recién nacido"
    if (a.newborn === true) a.newborn = false;

    let leveledUp = false;
    let guard = 0;
    let canLevelUp = true;
    while (guard++ < 25 && canLevelUp) {
        const need = petXpToNext(pet);
        a.xpToNext = need;
        if (a.xp < need) {
            canLevelUp = false;
        } else {
            a.xp -= need;
            pet.level = Math.max(1, Math.trunc(safeNumber(pet.level, 1))) + 1;
            leveledUp = true;
        }
    }

    const after = {
        affection: care.affection,
        hunger: care.hunger,
        hygiene: care.hygiene,
        xp: a.xp,
        level: Math.max(1, Math.trunc(safeNumber(pet.level, 1))),
    };

    return {
        changed: true,
        leveledUp,
        xpGained: xpAwardedByAction,
        delta: {
            affection: after.affection - before.affection,
            hunger: after.hunger - before.hunger,
            hygiene: after.hygiene - before.hygiene,
            levels: after.level - before.level,
        },
        snapshot: { before, after },
    };
}

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
            newborn: true,
            hatchedAt: new Date(),
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
    // --- New pet panel helpers ---
    getActivePet,
    ensurePetAttributes,
    petXpToNext,
    isPetAway,
    checkAndMarkPetAway,
    returnPetFromAway,
    applyPetAction,
};
