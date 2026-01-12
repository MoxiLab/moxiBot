const { buildLogEventContainer } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (emoji) => {
    if (isFlagEnabled('emojiCreate')) console.log('[EMOJICREATE_DEBUG] Ejecutado: emojiCreate');
    try {
        const guildDoc = await Guild.findOne({ guildID: emoji.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (!logChannelId) return;
        const logChannel = await emoji.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        const container = buildLogEventContainer({
            type: 'info',
            user: 'Sistema',
            extra: `Emoji creado: ${emoji.name}`,
            timestamp: new Date()
        });
        await logChannel.send({ content: '', components: [container] });
    } catch (e) {}
};
