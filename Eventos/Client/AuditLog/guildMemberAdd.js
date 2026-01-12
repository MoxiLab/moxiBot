const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento para registrar la entrada de un usuario en el canal de auditoría
const { memberJoinEmbed } = require('../../../Util/auditMemberEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (member) => {
    const { guild, id: userId } = member;
    auditLogDebug('guildMemberAdd', { guildId: guild?.id, userId });
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = memberJoinEmbed({ userId, timeStr });
    await ch.send(v2).catch(() => null);
};
