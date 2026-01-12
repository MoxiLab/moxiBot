const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: integración creada
const { integrationCreateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (integration) => {
    const { guild, name, id, type, account } = integration;
    auditLogDebug('integrationCreate', { guildId: guild?.id, name, id, type, account });
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = integrationCreateEmbed({ name, id, type, account, timeStr });
    await ch.send(v2).catch(() => null);
};
