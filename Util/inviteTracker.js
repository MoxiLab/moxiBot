const { PermissionFlagsBits } = require('discord.js');
const { readStoredInviteConfig, writeStoredInviteConfig } = require('./permanentInvite');

const inviteUsesCache = new Map();

function guardEnabled() {
    return String(process.env.INVITE_GUARD_ENABLED || 'true').toLowerCase() === 'true';
}

function trackingEnabled() {
    return String(process.env.INVITE_TRACK_ENABLED || 'true').toLowerCase() === 'true';
}

function canFetchGuildInvites(guild) {
    const me = guild?.members?.me;
    return !!(me?.permissions?.has(PermissionFlagsBits.ManageGuild) && guild?.invites && typeof guild.invites.fetch === 'function');
}

async function snapshotGuildInvites(guild) {
    if (!guild) return null;

    // Prefer full fetch if allowed.
    if (canFetchGuildInvites(guild)) {
        const invites = await guild.invites.fetch().catch(() => null);
        if (!invites) return null;
        const map = new Map();
        for (const inv of invites.values()) map.set(inv.code, Number(inv.uses || 0));
        inviteUsesCache.set(guild.id, map);
        return map;
    }

    // Fallback: only the stored permanent invite.
    const stored = await readStoredInviteConfig(guild.id).catch(() => null);
    if (stored?.code && guild.client?.fetchInvite) {
        const inv = await guild.client.fetchInvite(stored.code).catch(() => null);
        if (inv) {
            const map = new Map([[inv.code, Number(inv.uses || 0)]]);
            inviteUsesCache.set(guild.id, map);
            return map;
        }
    }

    return null;
}

async function detectUsedInviteOnJoin(member) {
    if (!trackingEnabled()) return null;

    const guild = member?.guild;
    if (!guild) return null;

    const before = inviteUsesCache.get(guild.id) || (await snapshotGuildInvites(guild));
    const after = await snapshotGuildInvites(guild);
    if (!before || !after) return null;

    // Find invite whose uses increased.
    let used = null;
    for (const [code, usesAfter] of after.entries()) {
        const usesBefore = Number(before.get(code) || 0);
        if (usesAfter > usesBefore) {
            used = { code, usesBefore, usesAfter };
            break;
        }
    }

    if (!used) return null;

    // Enrich with stored metadata if this is the stored permanent invite.
    const stored = await readStoredInviteConfig(guild.id).catch(() => null);
    if (stored?.code === used.code) {
        used.requestedByUserId = stored.requestedByUserId || null;
        used.requestedByTag = stored.requestedByTag || null;
        used.channelId = stored.channelId || null;
    }

    return used;
}

async function enforceNoManualInvites(invite) {
    if (!guardEnabled()) return { enforced: false };

    const guild = invite?.guild;
    if (!guild) return { enforced: false };

    const botId = guild.client?.user?.id;
    const inviterId = invite?.inviterId || invite?.inviter?.id || null;

    // Allow bot-created invites.
    if (botId && inviterId === botId) {
        // If it's permanent, persist it as the official one.
        const permanent = invite.maxAge === 0 && invite.maxUses === 0 && invite.temporary === false;
        if (permanent) {
            await writeStoredInviteConfig(guild.id, {
                code: invite.code,
                channelId: invite.channelId || invite.channel?.id || null,
            }).catch(() => null);
        }
        return { enforced: false };
    }

    // Delete any non-bot invite if possible.
    try {
        await invite.delete('Manual invites disabled: only bot permanent invite allowed');
        return { enforced: true, deleted: true, inviterId };
    } catch (err) {
        return { enforced: true, deleted: false, inviterId, error: String(err?.message || err) };
    }
}

module.exports = {
    snapshotGuildInvites,
    detectUsedInviteOnJoin,
    enforceNoManualInvites,
    guardEnabled,
    trackingEnabled,
};
