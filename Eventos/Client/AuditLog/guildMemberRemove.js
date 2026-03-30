const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: usuario sale del servidor
const { memberRemoveEmbed } = require('../../../Util/auditGeneralEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (member) => {
    const { guild, id: userId } = member;
    auditLogDebug('guildMemberRemove', { guildId: guild?.id, userId });
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = memberRemoveEmbed({ userId, timeStr });
    await ch.send(v2).catch(() => null);
};
