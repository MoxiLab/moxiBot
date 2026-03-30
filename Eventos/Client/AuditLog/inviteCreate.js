// Evento: invitación creada

const { inviteCreateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');
const { enforceNoManualInvites, snapshotGuildInvites } = require('../../../Util/inviteTracker');

module.exports = async (invite) => {
    const { guild, code, inviter, channel } = invite;
    auditLogDebug('inviteCreate', { guildId: guild?.id, code, inviter: inviter?.id, channel: channel?.id });

    // Enforce: no manual invites (best-effort).
    try {
        await enforceNoManualInvites(invite);
    } catch { }

    // Refresh snapshot for join tracking.
    try {
        await snapshotGuildInvites(guild);
    } catch { }

    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = inviteCreateEmbed({ code, inviterId: inviter?.id, channelId: channel?.id, timeStr });
    await ch.send(v2).catch(() => null);
};
