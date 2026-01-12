const { buildLogEventEmbed } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (oldRole, newRole) => {
    if (isFlagEnabled('roleUpdate')) console.log('[ROLEUPDATE_DEBUG] Ejecutado: roleUpdate');
    try {
        const guildDoc = await Guild.findOne({ guildID: oldRole.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (!logChannelId) return;
        const logChannel = await oldRole.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        const embed = buildLogEventEmbed({
            type: 'info',
            user: 'Sistema',
            extra: `Rol actualizado: ${oldRole.name} → ${newRole.name}`,
            timestamp: new Date()
        });
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error('[LOG EVENT ERROR]', e);
    }
};
