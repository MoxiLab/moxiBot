const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: integración actualizada
const { integrationUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (oldIntegration, newIntegration) => {
    const { guild, name: oldName, id, type, account } = oldIntegration;
    const { name: newName } = newIntegration;
    auditLogDebug('integrationUpdate', { guildId: guild?.id, id, oldName, newName, type, account });
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = integrationUpdateEmbed({ oldName, newName, id, type, account, timeStr });
    await ch.send(v2).catch(() => null);
};
