// Evento: sticker creado

const { stickerCreateEmbed } = require('../../../Util/auditAdminEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (sticker) => {
    const { guild, name, id, format } = sticker;
    auditLogDebug('stickerCreate', { guildId: guild?.id, name, id, format });
    const { lang, channelId, enabled } = await resolveAuditConfig(guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = stickerCreateEmbed({ name, id, format, timeStr });
    await ch.send(v2).catch(() => null);
};
