
// Evento: rol actualizado
const { roleUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (oldRole, newRole) => {
    const { guild, name: oldName, color: oldColor, permissions: oldPerms } = oldRole;
    const { name: newName, color: newColor, permissions: newPerms } = newRole;
    auditLogDebug('roleUpdate', { guildId: guild?.id, oldName, newName, oldColor, newColor });
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = roleUpdateEmbed({ oldName, newName, oldColor, newColor, oldPerms, newPerms, timeStr });
    await ch.send(v2).catch(() => null);
};
