const { buildLogEventEmbed } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (oldMessage, newMessage) => {
    if (isFlagEnabled('messageUpdate')) console.log('[MESSAGEUPDATE_DEBUG] Ejecutado: messageUpdate');
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    try {
        const guildDoc = await Guild.findOne({ guildID: oldMessage.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (logChannelId) {
            const logChannel = await oldMessage.guild.channels.fetch(logChannelId).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
                const embed = buildLogEventEmbed({
                    type: 'edit',
                    user: `${oldMessage.author.username}`,
                    oldContent: oldMessage.content,
                    newContent: newMessage.content,
                    channel: `<#${oldMessage.channel.id}>`,
                    timestamp: new Date()
                });
                await logChannel.send({ embeds: [embed] });
            } 
        }
    } catch (e) {
        console.error('[LOG EVENT ERROR]', e);
    } 
};
