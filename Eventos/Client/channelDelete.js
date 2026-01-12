const { buildLogEventEmbed } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (channel) => {
    if (isFlagEnabled('channelDelete')) console.log('[CHANNELDELETE_DEBUG] Ejecutado: channelDelete');
    try {
        const guildDoc = await Guild.findOne({ guildID: channel.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (!logChannelId) return;
        const logChannel = await channel.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        const embed = buildLogEventEmbed({
            type: 'delete',
            user: 'Sistema',
            extra: `Canal eliminado: ${channel.name} (${channel.id})`,
            timestamp: new Date()
        });
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error('[LOG EVENT ERROR]', e);
    }
};
