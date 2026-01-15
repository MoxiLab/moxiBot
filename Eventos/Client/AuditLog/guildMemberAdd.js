const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento para registrar la entrada de un usuario en el canal de auditoría
const { memberJoinEmbed } = require('../../../Util/auditMemberEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const { detectUsedInviteOnJoin } = require('../../../Util/inviteTracker');

module.exports = async (member) => {
    const { guild, id: userId } = member;
    auditLogDebug('guildMemberAdd', { guildId: guild?.id, userId });
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');

    let inviteLine = '';
    try {
        const used = await detectUsedInviteOnJoin(member);
        if (used?.code) {
            const who = used.requestedByUserId ? `<@${used.requestedByUserId}>` : (used.requestedByTag || 'Desconocido');
            inviteLine = `Invitación usada: https://discord.gg/${used.code} (solicitada por: ${who})`;
        }
    } catch { }

    const v2 = memberJoinEmbed({ userId, timeStr, inviteLine });
    await ch.send(v2).catch(() => null);
};
