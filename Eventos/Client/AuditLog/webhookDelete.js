// Evento: webhook eliminado
const { webhookDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (webhook) => {
    const { guild, name, id, channelId } = webhook;
    auditLogDebug('webhookDelete', { guildId: guild?.id, id, name, channelId });
    const { lang, channelId: auditChannelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !auditChannelId) return;
    const ch = guild.channels.cache.get(auditChannelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = webhookDeleteEmbed({ name, id, channelId, timeStr });
    await ch.send(v2).catch(() => null);
};
