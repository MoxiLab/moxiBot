const { Schema, model, models } = require('mongoose');
const { ensureMongoConnection } = require('../Util/mongoConnect');

const COLLECTION_PRIMARY = 'verify';
const COLLECTION_LEGACY = 'verification_configs';

function normalizeId(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const str = String(value).trim();
  return str || null;
}

function normalizeText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const str = String(value);
  const trimmed = str.trim();
  return trimmed ? trimmed : null;
}

function normalizeUrl(value) {
  const str = normalizeText(value);
  if (str === undefined) return undefined;
  if (str === null) return null;
  if (!/^https?:\/\//i.test(str)) return null;
  return str;
}

function normalizeColor(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return parseInt(hex, 16);
}

const VerifySchema = new Schema({
  guildId: { type: String, required: true, unique: true },

  enabled: { type: Boolean, default: false },

  channelId: { type: String, default: null },
  verifiedRoleId: { type: String, default: null },
  unverifiedRoleId: { type: String, default: null },
  panelMessageId: { type: String, default: null },

  captchaLength: { type: Number, default: 6 },
  captchaTtlMs: { type: Number, default: 2 * 60 * 1000 },
  maxAttempts: { type: Number, default: 3 },

  panelTitle: { type: String, default: null },
  panelBody: { type: String, default: null },
  panelButtonLabel: { type: String, default: null },
  panelImageUrl: { type: String, default: null },
  panelAccentColor: { type: Number, default: null },
}, {
  timestamps: true,
  collection: COLLECTION_PRIMARY,
});

const VerifyModel = models.Verify || model('Verify', VerifySchema);

async function getVerificationConfig(guildId) {
  if (!guildId) return null;
  const id = String(guildId);
  const connection = await ensureMongoConnection();

  const doc = await VerifyModel.findOne({ guildId: id }).lean().exec();
  if (doc) return doc;

  // Compat: si existe configuración antigua, devolverla
  try {
    const legacy = await connection.db.collection(COLLECTION_LEGACY).findOne({ guildId: id });
    return legacy || null;
  } catch {
    return null;
  }
}

async function upsertVerificationConfig(guildId, patch) {
  if (!guildId) throw new Error('guildId is required');
  await ensureMongoConnection();

  const now = new Date();
  const safePatch = patch && typeof patch === 'object' ? { ...patch } : {};

  if ('channelId' in safePatch) safePatch.channelId = normalizeId(safePatch.channelId);
  if ('verifiedRoleId' in safePatch) safePatch.verifiedRoleId = normalizeId(safePatch.verifiedRoleId);
  if ('unverifiedRoleId' in safePatch) safePatch.unverifiedRoleId = normalizeId(safePatch.unverifiedRoleId);
  if ('panelMessageId' in safePatch) safePatch.panelMessageId = normalizeId(safePatch.panelMessageId);

  if ('panelTitle' in safePatch) safePatch.panelTitle = normalizeText(safePatch.panelTitle);
  if ('panelBody' in safePatch) safePatch.panelBody = normalizeText(safePatch.panelBody);
  if ('panelButtonLabel' in safePatch) safePatch.panelButtonLabel = normalizeText(safePatch.panelButtonLabel);
  if ('panelImageUrl' in safePatch) safePatch.panelImageUrl = normalizeUrl(safePatch.panelImageUrl);
  if ('panelAccentColor' in safePatch) safePatch.panelAccentColor = normalizeColor(safePatch.panelAccentColor);

  const update = {
    $setOnInsert: { guildId: String(guildId), createdAt: now },
    $set: { ...safePatch, updatedAt: now },
  };

  const result = await VerifyModel.updateOne({ guildId: String(guildId) }, update, { upsert: true }).exec();
  return result.matchedCount > 0 || result.upsertedCount > 0;
}

async function disableVerification(guildId) {
  return upsertVerificationConfig(guildId, { enabled: false });
}

module.exports = {
  VerifySchema,
  VerifyModel,
  getVerificationConfig,
  upsertVerificationConfig,
  disableVerification,
};
