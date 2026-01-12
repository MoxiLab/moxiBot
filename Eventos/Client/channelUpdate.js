const { buildLogEventEmbed } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (oldChannel, newChannel) => {
    if (isFlagEnabled('channelUpdate')) console.log('[CHANNELUPDATE_DEBUG] Ejecutado: channelUpdate');
    if (!newChannel.guild) return;
    try {
        const guildDoc = await Guild.findOne({ guildID: oldChannel.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (!logChannelId) return;
        const logChannel = await oldChannel.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        const embed = buildLogEventEmbed({
            type: 'info',
            user: 'Sistema',
            extra: `Canal actualizado: ${oldChannel.name} → ${newChannel.name}`,
            timestamp: new Date()
        });
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error('[LOG EVENT ERROR]', e);
    }
};
