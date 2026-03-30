
// Evento: mensajes eliminados masivamente
const { messageBulkDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (messages) => {
    auditLogDebug('messageBulkDelete', 'Evento disparado. Tamaño:', messages?.size);
    if (!messages || messages.size === 0) return;
    const firstMsg = messages.first();
    const { guild, channel } = firstMsg;
    if (!guild) {
        auditLogDebug('messageBulkDelete', 'No guild');
        return;
    }
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) {
        auditLogDebug('messageBulkDelete', 'Audit log deshabilitado o sin canal');
        return;
    }
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') {
        auditLogDebug('messageBulkDelete', 'Canal de logs no encontrado o sin permisos');
        return;
    }
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = messageBulkDeleteEmbed({ channelId: channel.id, count: messages.size, timeStr });
    auditLogDebug('messageBulkDelete', 'Enviando objeto audit (bulk):', JSON.stringify(v2, null, 2));
    await ch.send(v2).catch(e => auditLogDebug('messageBulkDelete', 'Error al enviar log:', e));
};
