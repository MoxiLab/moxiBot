const { buildLogEventEmbed } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (role) => {
    if (isFlagEnabled('roleDelete')) console.log('[ROLEDELETE_DEBUG] Ejecutado: roleDelete');
    try {
        const guildDoc = await Guild.findOne({ guildID: role.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (!logChannelId) return;
        const logChannel = await role.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        const embed = buildLogEventEmbed({
            type: 'delete',
            user: 'Sistema',
            extra: `Rol eliminado: ${role.name} (${role.id})`,
            timestamp: new Date()
        });
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error('[LOG EVENT ERROR]', e);
    }
};
