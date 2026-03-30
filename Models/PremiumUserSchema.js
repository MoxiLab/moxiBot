const { Schema, model, models } = require('mongoose');
const { ensureMongoConnection } = require('../Util/mongoConnect');
const { normalizeDiscordId } = require('../Util/idGuards');

const COLLECTION_PRIMARY = process.env.PREMIUM_USERS_COLLECTION
  ? String(process.env.PREMIUM_USERS_COLLECTION).trim()
  : 'premium_users';

function normalizeId(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return normalizeDiscordId(value) || null;
}

function normalizeText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const str = String(value);
  const trimmed = str.trim();
  return trimmed ? trimmed : null;
}

function normalizeTier(value) {
  const t = normalizeText(value);
  if (t === undefined) return undefined;
  if (t === null) return null;
  const key = t.toLowerCase();
  // dejamos flexible para futuros tiers
  return key;
}

function normalizeDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

const PremiumUserSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  tier: { type: String, default: 'premium' },
  expiresAt: { type: Date, default: null }, // null = lifetime

  grantedBy: { type: String, default: null },
  reason: { type: String, default: null },
}, {
  timestamps: true,
  collection: COLLECTION_PRIMARY,
});

PremiumUserSchema.index({ expiresAt: 1 });

const PremiumUserModel = models.PremiumUser || model('PremiumUser', PremiumUserSchema);

async function getPremiumUser(userId) {
  const uid = normalizeId(userId);
  if (!uid) return null;
  await ensureMongoConnection();
  return PremiumUserModel.findOne({ userId: uid }).lean().exec();
}

async function upsertPremiumUser(userId, patch) {
  const uid = normalizeId(userId);
  if (!uid) throw new Error('userId is required');
  await ensureMongoConnection();

  const now = new Date();
  const safePatch = patch && typeof patch === 'object' ? { ...patch } : {};

  if ('tier' in safePatch) safePatch.tier = normalizeTier(safePatch.tier) ?? 'premium';
  if ('expiresAt' in safePatch) safePatch.expiresAt = normalizeDate(safePatch.expiresAt);
  if ('grantedBy' in safePatch) safePatch.grantedBy = normalizeId(safePatch.grantedBy);
  if ('reason' in safePatch) safePatch.reason = normalizeText(safePatch.reason);

  const update = {
    $setOnInsert: { userId: uid, createdAt: now },
    $set: { ...safePatch, updatedAt: now },
  };

  const res = await PremiumUserModel.updateOne({ userId: uid }, update, { upsert: true }).exec();
  return res.matchedCount > 0 || res.upsertedCount > 0;
}

async function removePremiumUser(userId) {
  const uid = normalizeId(userId);
  if (!uid) return false;
  await ensureMongoConnection();
  const res = await PremiumUserModel.deleteOne({ userId: uid }).exec();
  return res.deletedCount > 0;
}

module.exports = {
  PremiumUserSchema,
  PremiumUserModel,
  getPremiumUser,
  upsertPremiumUser,
  removePremiumUser,
};
