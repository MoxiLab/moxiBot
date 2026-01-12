// Evento: mensajes eliminados masivamente
const { messageBulkDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (messages) => {
    console.log('[DEBUG][messageBulkDelete] Evento disparado. Tamaño:', messages?.size);
    if (!messages || messages.size === 0) return;
    const firstMsg = messages.first();
    const { guild, channel } = firstMsg;
    if (!guild) {
        console.log('[DEBUG][messageBulkDelete] No guild');
        return;
    }
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) {
        console.log('[DEBUG][messageBulkDelete] Audit log deshabilitado o sin canal');
        return;
    }
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') {
        console.log('[DEBUG][messageBulkDelete] Canal de logs no encontrado o sin permisos');
        return;
    }
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = messageBulkDeleteEmbed({ channelId: channel.id, count: messages.size, timeStr });
    await ch.send(v2).catch(e => console.log('[DEBUG][messageBulkDelete] Error al enviar log:', e));
};
