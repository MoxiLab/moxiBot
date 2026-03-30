const { PermissionsBitField } = require('discord.js');
const debugHelper = require('./debugHelper');

const DISCORD_OWNER_CACHE_TTL_MS = 5 * 60 * 1000;
const discordOwnerCache = new Map(); // userId -> { expiresAt, value }

function getAllowedOwnerIds() {
    const raw = String(process.env.ALLOWED_IDS || '').trim();
    if (!raw) return [];
    return raw.split(',').map(id => String(id).trim()).filter(Boolean);
}

function isBotOwner(userId) {
    if (!userId) return false;
    const allowed = getAllowedOwnerIds();
    return allowed.includes(String(userId));
}

function isGuildOwner({ userId, guildOwnerId } = {}) {
    if (!userId || !guildOwnerId) return false;
    return String(userId) === String(guildOwnerId);
}

function isOwner({ userId, guildOwnerId } = {}) {
    return isGuildOwner({ userId, guildOwnerId }) || isBotOwner(userId);
}

async function isDiscordApplicationOwner(Moxi, userId) {
    if (!Moxi || !userId) return false;

    const uidKey = String(userId);
    const cached = discordOwnerCache.get(uidKey);
    const now = Date.now();
    if (cached && typeof cached.expiresAt === 'number' && cached.expiresAt > now) {
        return Boolean(cached.value);
    }

    const ownerDebugEnabled = debugHelper.isEnabled('owner');
    try {
        // Asegura que application está cargada (incluye owner/team)
        let app = Moxi.application;
        if (ownerDebugEnabled) {
            debugHelper.log('owner', 'start hasApplication=' + Boolean(app) + ' hasFetch=' + Boolean(app && typeof app.fetch === 'function'));
        }

        if (app && typeof app.fetch === 'function') {
            // fetch() devuelve la aplicación con owner/team bien poblado
            app = await app.fetch();
            if (ownerDebugEnabled) {
                debugHelper.log('owner', 'application.fetch() ok');
            }
        }

        const owner = app?.owner || Moxi.application?.owner;
        if (!owner) return false;

        if (ownerDebugEnabled) {
            const ownerType = owner && owner.constructor ? owner.constructor.name : typeof owner;
            const hasMembers = Boolean(owner && owner.members);
            const membersType = owner && owner.members && owner.members.constructor ? owner.members.constructor.name : typeof owner?.members;

            const teamId = owner && owner.id ? String(owner.id) : 'n/a';
            const teamOwnerId = owner && owner.ownerId ? String(owner.ownerId) : 'n/a';

            debugHelper.log('owner', 'ownerType=' + ownerType + ' userId=' + String(userId) + ' teamId=' + teamId + ' teamOwnerId=' + teamOwnerId + ' hasMembers=' + hasMembers + ' membersType=' + membersType);

            const members = owner && owner.members;
            if (members && typeof members.has === 'function') {
                const size = typeof members.size === 'number' ? members.size : 'n/a';
                const hasKey = members.has(String(userId));
                const keysSample = (typeof members.keys === 'function')
                    ? Array.from(members.keys()).slice(0, 5).join(',')
                    : 'n/a';
                let valuesSample = 'n/a';
                if (typeof members.values === 'function') {
                    valuesSample = Array.from(members.values())
                        .slice(0, 5)
                        .map(m => String(m?.user?.id || m?.id || m?.userId || 'n/a'))
                        .join(',');
                }
                debugHelper.log('owner', 'members.size=' + size + ' members.has=' + hasKey + ' keysSample=' + keysSample + ' valuesSample=' + valuesSample);
            }
        }

        const uid = String(userId);
        const ownerTypeName = owner && owner.constructor ? owner.constructor.name : '';
        const isTeam = ownerTypeName === 'Team' || Boolean(owner && (owner.ownerId || owner.members));

        // Caso 1: owner es un usuario (Application owner)
        // Nota: un Team también tiene `.id` (teamId), por eso solo aplicamos esto si NO es Team.
        if (!isTeam && owner.id) {
            const ok = String(owner.id) === uid;
            discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: ok });
            return ok;
        }

        // Caso 2: owner es un Team (discord.js v14)
        // - Team.ownerId: dueño del team
        if (isTeam && owner.ownerId && String(owner.ownerId) === uid) {
            discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: true });
            return true;
        }

        const members = isTeam ? owner.members : null;

        // members puede ser Collection/Map (keys suelen ser userId)
        if (members && typeof members.has === 'function') {
            if (members.has(uid)) {
                discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: true });
                return true;
            }
            // Por si el key no es el userId, iterar valores
            if (typeof members.values === 'function') {
                for (const m of members.values()) {
                    const mid = m?.id || m?.user?.id;
                    if (mid && String(mid) === uid) {
                        discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: true });
                        return true;
                    }
                }
            }
            discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: false });
            return false;
        }

        // members puede venir como objeto plano (según versión/serialización)
        if (members && typeof members === 'object') {
            if (uid in members) {
                discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: true });
                return true;
            }
            // o como { members: { id: TeamMember } }
            if (members.members && typeof members.members === 'object' && uid in members.members) {
                discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: true });
                return true;
            }

            // o como objeto { <key>: TeamMember }
            for (const m of Object.values(members)) {
                const mid = m?.id || m?.user?.id;
                if (mid && String(mid) === uid) {
                    discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: true });
                    return true;
                }
            }

            if (members.members && typeof members.members === 'object') {
                for (const m of Object.values(members.members)) {
                    const mid = m?.id || m?.user?.id;
                    if (mid && String(mid) === uid) {
                        discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: true });
                        return true;
                    }
                }
            }

            discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: false });
        }
    } catch {
        if (debugHelper.isEnabled('owner')) {
            debugHelper.error('owner', 'error in isDiscordApplicationOwner');
        }
        return false;
    }

    discordOwnerCache.set(uidKey, { expiresAt: now + DISCORD_OWNER_CACHE_TTL_MS, value: false });
    return false;
}

async function isOwnerWithClient({ client: Moxi, userId, guildOwnerId } = {}) {
    if (isGuildOwner({ userId, guildOwnerId })) return true;
    if (isBotOwner(userId)) return true;
    return await isDiscordApplicationOwner(Moxi, userId);
}

async function isDiscordOnlyOwner({ client: Moxi, userId } = {}) {
    return await isDiscordApplicationOwner(Moxi, userId);
}

async function ownerPermissions(interaction, Moxi) {
    if (!interaction || !interaction.user) return false;
    if (interaction.memberPermissions?.has?.(PermissionsBitField.Flags.Administrator)) {
        return true;
    }
    const guildOwnerId = interaction.guild?.ownerId || interaction.guild?.owner?.id || interaction.guild?.ownerId;
    return await isOwnerWithClient({ client: Moxi, userId: interaction.user.id, guildOwnerId });
}

module.exports = {
    getAllowedOwnerIds,
    isBotOwner,
    isGuildOwner,
    isOwner,
    isDiscordApplicationOwner,
    isOwnerWithClient,
    isDiscordOnlyOwner,
    ownerPermissions,
};
