const { buildLogEventContainer } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');

module.exports = async (oldRole, newRole) => {
    try {
        const guildDoc = await Guild.findOne({ guildID: newRole.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (!logChannelId) return;
        const logChannel = await newRole.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        const container = buildLogEventContainer({
            type: 'edit',
            user: 'Sistema',
            oldContent: oldRole.name,
            newContent: newRole.name,
            extra: 'Rol actualizado',
            timestamp: new Date()
        });
        await logChannel.send({ content: '', components: [container] });
    } catch (e) {}
};
