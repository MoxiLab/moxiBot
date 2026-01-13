// Evento: canal actualizado
const { channelUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (oldChannel, newChannel) => {
    if (!oldChannel || !newChannel) return;

    const { guild, id: channelId, name: oldName, type: oldType } = oldChannel;
    const { name: newName, type: newType } = newChannel;
    const auditLogDebug = require('../../../Util/auditLogDebug');
    auditLogDebug('channelUpdate', { guildId: guild?.id, channelId, oldName, newName, oldType, newType });

    if (!guild?.id) return;
    const { lang, channelId: auditChannelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !auditChannelId) return;
    const ch = guild.channels.cache.get(auditChannelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = channelUpdateEmbed({ channelId, oldName, newName, oldType, newType, timeStr });
    await ch.send(v2).catch(() => null);
};
