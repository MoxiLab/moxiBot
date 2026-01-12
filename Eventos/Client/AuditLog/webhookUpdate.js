// Evento: webhook actualizado
const { webhookUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (oldWebhook, newWebhook) => {
    const { guild, name: oldName, id, channelId: oldChannelId } = oldWebhook;
    const { name: newName, channelId: newChannelId } = newWebhook;
    auditLogDebug('webhookUpdate', { guildId: guild?.id, id, oldName, newName, oldChannelId, newChannelId });
    const { lang, channelId: auditChannelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !auditChannelId) return;
    const ch = guild.channels.cache.get(auditChannelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = webhookUpdateEmbed({ oldName, newName, id, oldChannelId, newChannelId, timeStr });
    await ch.send(v2).catch(() => null);
};
