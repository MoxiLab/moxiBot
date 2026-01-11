const { buildLogEventContainer } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');

module.exports = async (message) => {
    if (!message.guild || message.author?.bot) return;
    try {
        const guildDoc = await Guild.findOne({ guildID: message.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (logChannelId) {
            const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
                const container = buildLogEventContainer({
                    type: 'delete',
                    user: `${message.author.username}`,
                    oldContent: message.content,
                    channel: `<#${message.channel.id}>`,
                    timestamp: new Date()
                });
                await logChannel.send({ content: '', components: [container] });
            }
        }
    } catch (e) {}
};
