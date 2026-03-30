const auditLogDebug = require('../../../Util/auditLogDebug');
// Evento: emoji creado
const { emojiCreateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');

module.exports = async (emoji) => {
    const { guild, name, id, animated } = emoji;
    auditLogDebug('emojiCreate', { guildId: guild?.id, name, id, animated });
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = emojiCreateEmbed({ name, id, animated, timeStr });
    await ch.send(v2).catch(() => null);
};
