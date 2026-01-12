// Evento: mensaje eliminado
const { messageDeleteEmbed } = require('../../../Util/auditAdminEmbeds');
const audit = require('../../../Util/audit');

module.exports = async (message) => {
    // Si la bandera global de borrado masivo está activa, no enviar log individual
    if (global.__moxiBulkDelete) return;
    console.log('[AUDITLOG][DEBUG] Evento messageDelete disparado:', {
        id: message.id,
        author: message.author?.id,
        channel: message.channel?.id,
        guild: message.guild?.id
    });
    if (!message.guild) return;
    const { lang, channelId, enabled } = await audit.resolveAuditConfig(message.guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = message.guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const logObj = messageDeleteEmbed({ authorId: message.author?.id || message.member?.id, channelId: message.channel.id, timeStr });
    console.log('[AUDITLOG][DEBUG] Enviando objeto audit:', JSON.stringify(logObj, null, 2));
    await ch.send(logObj).catch((err) => {
        console.error('[AUDITLOG][ERROR] Fallo al enviar log audit:', err);
    });
};
