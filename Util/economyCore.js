const { ensureMongoConnection } = require('./mongoConnect');

const STARTER_EGG_ITEM_ID = 'mascotas/huevo-de-bosque';

function starterInventory() {
  return [{ itemId: STARTER_EGG_ITEM_ID, amount: 1, obtainedAt: new Date() }];
}

function hasAnyEgg(inventory) {
  const inv = Array.isArray(inventory) ? inventory : [];
  return inv.some((row) => {
    const itemId = String(row?.itemId || '');
    const amount = Number(row?.amount || 0);
    return itemId.startsWith('mascotas/huevo-') && amount > 0;
  });
}

function safeInt(n, fallback = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.trunc(x);
}

function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function msUntilNext(lastDate, cooldownMs) {
  const last = lastDate instanceof Date ? lastDate.getTime() : 0;
  const next = last + cooldownMs;
  return Math.max(0, next - Date.now());
}

async function getOrCreateEconomy(userId) {
  if (!process.env.MONGODB) {
    throw new Error('MongoDB no está configurado (MONGODB vacío).');
  }

  await ensureMongoConnection();

  const { Economy } = require('../Models/EconomySchema');

  // Upsert atómico para evitar carreras (shards / comandos simultáneos)
  try {
    await Economy.updateOne(
      { userId },
      { $setOnInsert: { userId, balance: 0, bank: 0, sakuras: 0, inventory: starterInventory() } },
      { upsert: true }
    );
  } catch (e) {
    // Si hubo una carrera y el doc se creó justo antes, ignoramos el DuplicateKey.
    if (e?.code !== 11000) throw e;
  }

  const eco = await Economy.findOne({ userId });

  // Backfill suave: si el usuario no tiene ningún huevo y aún no tiene mascota/incubación, le damos 1 huevo inicial.
  if (eco) {
    const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
    const pets = Array.isArray(eco.pets) ? eco.pets : [];
    const hasEgg = hasAnyEgg(inv);
    const hasIncubation = Boolean(eco.petIncubation?.eggItemId);

    if (!hasEgg && pets.length === 0 && !hasIncubation) {
      if (inv.length === 0) {
        eco.inventory = starterInventory();
      } else {
        inv.push({ itemId: STARTER_EGG_ITEM_ID, amount: 1, obtainedAt: new Date() });
        eco.inventory = inv;
      }
      await eco.save();
    }
  }

  return eco;
}

async function claimCooldownReward({
  userId,
  field,
  cooldownMs,
  minAmount,
  maxAmount,
} = {}) {
  if (!process.env.MONGODB) {
    return { ok: false, reason: 'no-db', message: 'MongoDB no está configurado (MONGODB vacío).' };
  }

  await ensureMongoConnection();

  const { Economy } = require('../Models/EconomySchema');

  const now = new Date();
  const cutoff = new Date(Date.now() - cooldownMs);
  const amount = Math.max(minAmount, Math.min(maxAmount, Math.floor(minAmount + Math.random() * (maxAmount - minAmount + 1))));

  // 1) Asegura que el documento existe (sin depender del cooldown en el filtro)
  try {
    await Economy.updateOne(
      { userId },
      { $setOnInsert: { userId, balance: 0, bank: 0, sakuras: 0, inventory: starterInventory() } },
      { upsert: true }
    );
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }

  // 2) Intenta reclamar SOLO si ha pasado el cooldown (sin upsert para evitar E11000)
  const claimFilter = {
    userId,
    $or: [
      { [field]: { $exists: false } },
      { [field]: null },
      { [field]: { $lte: cutoff } },
    ],
  };

  const updated = await Economy.findOneAndUpdate(
    claimFilter,
    {
      $inc: { balance: amount },
      $set: { [field]: now },
    },
    { new: true }
  );

  if (updated) {
    return {
      ok: true,
      amount,
      balance: safeInt(updated.balance, 0),
      nextInMs: 0,
    };
  }

  const existing = await getOrCreateEconomy(userId);
  const remaining = msUntilNext(existing[field], cooldownMs);
  return {
    ok: false,
    reason: 'cooldown',
    nextInMs: remaining,
    balance: safeInt(existing.balance, 0),
  };
}

async function claimCooldown({
  userId,
  field,
  cooldownMs,
} = {}) {
  if (!process.env.MONGODB) {
    return { ok: false, reason: 'no-db', message: 'MongoDB no está configurado (MONGODB vacío).' };
  }

  await ensureMongoConnection();

  const { Economy } = require('../Models/EconomySchema');

  const now = new Date();
  const cutoff = new Date(Date.now() - cooldownMs);

  try {
    await Economy.updateOne(
      { userId },
      { $setOnInsert: { userId, balance: 0, bank: 0, sakuras: 0, inventory: starterInventory() } },
      { upsert: true }
    );
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }

  const claimFilter = {
    userId,
    $or: [
      { [field]: { $exists: false } },
      { [field]: null },
      { [field]: { $lte: cutoff } },
    ],
  };

  const updated = await Economy.findOneAndUpdate(
    claimFilter,
    { $set: { [field]: now } },
    { new: true }
  );

  if (updated) {
    return { ok: true, nextInMs: 0 };
  }

  const existing = await getOrCreateEconomy(userId);
  const remaining = msUntilNext(existing[field], cooldownMs);
  return { ok: false, reason: 'cooldown', nextInMs: remaining };
}

async function awardBalance({ userId, amount } = {}) {
  if (!process.env.MONGODB) {
    return { ok: false, reason: 'no-db', message: 'MongoDB no está configurado (MONGODB vacío).' };
  }

  const inc = safeInt(amount, 0);
  if (inc <= 0) {
    const existing = await getOrCreateEconomy(userId);
    return { ok: true, amount: 0, balance: safeInt(existing.balance, 0) };
  }

  await ensureMongoConnection();
  const { Economy } = require('../Models/EconomySchema');

  // Asegura doc
  try {
    await Economy.updateOne(
      { userId },
      { $setOnInsert: { userId, balance: 0, bank: 0, sakuras: 0, inventory: starterInventory() } },
      { upsert: true }
    );
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }

  const updated = await Economy.findOneAndUpdate(
    { userId },
    { $inc: { balance: inc } },
    { new: true }
  );

  return { ok: true, amount: inc, balance: safeInt(updated?.balance, 0) };
}

module.exports = {
  safeInt,
  formatDuration,
  msUntilNext,
  getOrCreateEconomy,
  claimCooldownReward,
  claimCooldown,
  awardBalance,
};
