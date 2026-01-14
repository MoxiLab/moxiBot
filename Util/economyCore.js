const { ensureMongoConnection } = require('./mongoConnect');

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

  const { UserEconomy } = require('../Models/EconomySchema');

  // Upsert atómico para evitar carreras (shards / comandos simultáneos)
  try {
    await UserEconomy.updateOne(
      { userId },
      { $setOnInsert: { userId, balance: 0, inventory: [] } },
      { upsert: true }
    );
  } catch (e) {
    // Si hubo una carrera y el doc se creó justo antes, ignoramos el DuplicateKey.
    if (e?.code !== 11000) throw e;
  }

  return UserEconomy.findOne({ userId });
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

  const { UserEconomy } = require('../Models/EconomySchema');

  const now = new Date();
  const cutoff = new Date(Date.now() - cooldownMs);
  const amount = Math.max(minAmount, Math.min(maxAmount, Math.floor(minAmount + Math.random() * (maxAmount - minAmount + 1))));

  // 1) Asegura que el documento existe (sin depender del cooldown en el filtro)
  try {
    await UserEconomy.updateOne(
      { userId },
      { $setOnInsert: { userId, balance: 0, inventory: [] } },
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

  const updated = await UserEconomy.findOneAndUpdate(
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

module.exports = {
  safeInt,
  formatDuration,
  msUntilNext,
  getOrCreateEconomy,
  claimCooldownReward,
};
