const { buildLogEventContainer } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');

module.exports = async (role) => {
    try {
        const guildDoc = await Guild.findOne({ guildID: role.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (!logChannelId) return;
        const logChannel = await role.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        const container = buildLogEventContainer({
            type: 'info',
            user: 'Sistema',
            extra: `Rol creado: ${role.name}`,
            timestamp: new Date()
        });
        await logChannel.send({ content: '', components: [container] });
    } catch (e) {}
};
