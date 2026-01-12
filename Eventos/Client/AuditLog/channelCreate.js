// Evento: canal creado

const { channelCreateEmbed } = require('../../../Util/auditGeneralEmbeds');
const { resolveAuditConfig } = require('../../../Util/audit');
const auditLogDebug = require('../../../Util/auditLogDebug');

module.exports = async (channel) => {
    if (!channel.guild) return;
    auditLogDebug('channelCreate', { guildId: channel.guild.id, channelId: channel.id });
    const { lang, channelId, enabled } = await resolveAuditConfig(channel.guild.id, 'es-ES');
    if (!enabled || !channelId) return;
    const ch = channel.guild.channels.cache.get(channelId);
    if (!ch || typeof ch.send !== 'function') return;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const v2 = channelCreateEmbed({ channelId: channel.id, timeStr });
    await ch.send(v2).catch(() => null);
};
