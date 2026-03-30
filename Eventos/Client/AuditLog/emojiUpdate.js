const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: emoji actualizado
const { emojiUpdateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (oldEmoji, newEmoji) => {
    const { guild, name: oldName, id, animated } = oldEmoji;
    const { name: newName } = newEmoji;
    auditLogDebug('emojiUpdate', { guildId: guild?.id, id, oldName, newName, animated });
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = emojiUpdateEmbed({ oldName, newName, id, animated, timeStr });
    await ch.send(v2).catch(() => null);
};
