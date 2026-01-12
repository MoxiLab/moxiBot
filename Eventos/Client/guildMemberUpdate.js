const { buildLogEventContainer } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (oldMember, newMember) => {
    if (isFlagEnabled('guildMemberUpdate')) console.log('[GUILDMEMBERUPDATE_DEBUG] Ejecutado: guildMemberUpdate');
    try {
        const guildDoc = await Guild.findOne({ guildID: newMember.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (!logChannelId) return;
        const logChannel = await newMember.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;

        // Cambio de nickname
        if (oldMember.nickname !== newMember.nickname) {
            const container = buildLogEventContainer({
                type: 'edit',
                user: `${newMember.user.username}`,
                oldContent: oldMember.nickname || oldMember.user.username,
                newContent: newMember.nickname || newMember.user.username,
                extra: 'Cambio de apodo',
                timestamp: new Date()
            });
            await logChannel.send({ content: '', components: [container] });
        }
        // Cambio de roles
        const oldRoles = oldMember.roles.cache.map(r => r.id).sort().join(',');
        const newRoles = newMember.roles.cache.map(r => r.id).sort().join(',');
        if (oldRoles !== newRoles) {
            const container = buildLogEventContainer({
                type: 'edit',
                user: `${newMember.user.username}`,
                oldContent: oldRoles,
                newContent: newRoles,
                extra: 'Cambio de roles',
                timestamp: new Date()
            });
            await logChannel.send({ content: '', components: [container] });
        }
    } catch (e) {}
};
