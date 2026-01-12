const { buildLogEventEmbed } = require('../../Components/V2/logEvent');
const { isFlagEnabled } = require('../../Util/debug');
const Guild = require('../../Models/GuildSchema');

module.exports = async (channel) => {
    console.log('[LOG TEST] Ejecutado: channelCreate');
        if (isFlagEnabled('channelCreate')) console.log('[CHANNELCREATE_DEBUG] Ejecutado: channelCreate');
    try {
        const guildDoc = await Guild.findOne({ guildID: channel.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (!logChannelId) return;
        const logChannel = await channel.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        const embed = buildLogEventEmbed({
            type: 'info',
            user: 'Sistema',
            extra: `Canal creado: <#${channel.id}> (${channel.name})`,
            timestamp: new Date()
        });
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error('[LOG EVENT ERROR]', e);
    }
};
