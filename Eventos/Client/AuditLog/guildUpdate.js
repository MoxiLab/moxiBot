// Evento: actualización del servidor
const { guildUpdateEmbed } = require('../../../Util/auditGeneralEmbeds');
const audit = require('../../../Util/audit');

module.exports = async (oldGuild, newGuild) => {
    const { lang, channelId, enabled } = await audit.resolveAuditConfig(newGuild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = newGuild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = guildUpdateEmbed({ oldName: oldGuild.name, newName: newGuild.name, timeStr });
    await ch.send(v2).catch(() => null);
    auditLogDebug('guildUpdate', { guildId: newGuild.id, oldName: oldGuild.name, newName: newGuild.name });
};
