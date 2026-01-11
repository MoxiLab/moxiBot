const { buildLogEventContainer } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');

module.exports = async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    try {
        const guildDoc = await Guild.findOne({ guildID: oldMessage.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (logChannelId) {
            const logChannel = await oldMessage.guild.channels.fetch(logChannelId).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
                const container = buildLogEventContainer({
                    type: 'edit',
                    user: `${oldMessage.author.username}`,
                    oldContent: oldMessage.content,
                    newContent: newMessage.content,
                    channel: `<#${oldMessage.channel.id}>`,
                    timestamp: new Date()
                });
                await logChannel.send({ content: '', components: [container] });
            }
        }
    } catch (e) {}
};
