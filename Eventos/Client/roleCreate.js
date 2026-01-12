const { buildLogEventEmbed } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (role) => {
    if (isFlagEnabled('roleCreate')) console.log('[ROLECREATE_DEBUG] Ejecutado: roleCreate');
    try {
        const guildDoc = await Guild.findOne({ guildID: role.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (!logChannelId) return;
        const logChannel = await role.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        const embed = buildLogEventEmbed({
            type: 'info',
            user: 'Sistema',
            extra: `Rol creado: <@&${role.id}> (${role.name})`,
            timestamp: new Date()
        });
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error('[LOG EVENT ERROR]', e);
    }
};
