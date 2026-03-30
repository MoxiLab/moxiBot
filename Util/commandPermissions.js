const { PermissionsBitField } = require('discord.js');

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizePermissionToken(token) {
  if (token === undefined || token === null) return null;

  if (typeof token === 'number' || typeof token === 'bigint') {
    return BigInt(token);
  }

  const raw = String(token).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    try {
      return BigInt(raw);
    } catch {
      return null;
    }
  }

  const keys = Object.keys(PermissionsBitField.Flags || {});
  const found = keys.find((k) => k.toLowerCase() === raw.toLowerCase());
  if (!found) return null;
  return PermissionsBitField.Flags[found];
}

function normalizePermissionList(list) {
  const out = [];
  for (const item of toArray(list)) {
    const normalized = normalizePermissionToken(item);
    if (normalized !== null) out.push(normalized);
  }
  return out;
}

function resolveDeclaredPermissions(command) {
  const raw = (command && typeof command.permissions === 'object')
    ? command.permissions
    : ((command && typeof command.Permissions === 'object') ? command.Permissions : {});
  const user = normalizePermissionList(raw.User || raw.user || []);
  const bot = normalizePermissionList(raw.Bot || raw.bot || []);
  return { user, bot };
}

function hasAllPermissions(holderPerms, requiredPerms) {
  if (!requiredPerms || requiredPerms.length === 0) return true;
  if (!holderPerms || typeof holderPerms.has !== 'function') return false;
  return requiredPerms.every((perm) => holderPerms.has(perm, true));
}

function missingPermissions(holderPerms, requiredPerms) {
  if (!requiredPerms || requiredPerms.length === 0) return [];
  if (!holderPerms || typeof holderPerms.has !== 'function') return [...requiredPerms];
  return requiredPerms.filter((perm) => !holderPerms.has(perm, true));
}

function humanizePermissionBits(bits) {
  const flags = PermissionsBitField.Flags || {};
  const out = [];
  for (const bit of bits || []) {
    const key = Object.keys(flags).find((k) => flags[k] === bit);
    out.push(key || String(bit));
  }
  return out;
}

async function checkCommandPermissions({ client, ctx, command }) {
  const declared = resolveDeclaredPermissions(command);

  if (!declared.user.length && !declared.bot.length) {
    return { blocked: false, userMissing: [], botMissing: [] };
  }

  const memberPerms = ctx?.memberPermissions || ctx?.member?.permissions || null;
  const guild = ctx?.guild || null;
  const me = guild?.members?.me || null;
  const botPerms = me?.permissions || null;

  const userMissingBits = missingPermissions(memberPerms, declared.user);
  const botMissingBits = missingPermissions(botPerms, declared.bot);

  return {
    blocked: userMissingBits.length > 0 || botMissingBits.length > 0,
    userMissing: humanizePermissionBits(userMissingBits),
    botMissing: humanizePermissionBits(botMissingBits),
  };
}

module.exports = {
  checkCommandPermissions,
  resolveDeclaredPermissions,
  hasAllPermissions,
};
