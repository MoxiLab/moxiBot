
// Evento: rol eliminado
const { roleDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (role) => {
    const { guild, name, id } = role;
    auditLogDebug('roleDelete', { guildId: guild?.id, name, id });
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = roleDeleteEmbed({ roleName: name, timeStr });
    await ch.send(v2).catch(() => null);
};
