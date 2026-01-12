// Evento: rol creado
const { roleCreateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (role) => {
    const { guild, name, id } = role;
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = roleCreateEmbed({ roleName: name, roleId: id, timeStr });
    await ch.send(v2).catch(() => null);
};
