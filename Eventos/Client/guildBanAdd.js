const { buildLogEventEmbed } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (guild, user) => {
    if (isFlagEnabled('guildBanAdd')) console.log('[GUILDBANADD_DEBUG] Ejecutado: guildBanAdd');
    try {
        const guildDoc = await Guild.findOne({ guildID: guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (logChannelId) {
            const logChannel = await guild.channels.fetch(logChannelId).catch((err) => { console.error('[LOG EVENT ERROR] Al buscar canal:', err); return null; });
            if (logChannel && logChannel.isTextBased()) {
                const embed = buildLogEventEmbed({
                    type: 'delete',
                    user: user.username,
                    extra: 'Usuario baneado',
                    timestamp: new Date()
                });
                try {
                    await logChannel.send({ embeds: [embed] });
                    console.log('[LOG EVENT DEBUG] Log enviado correctamente');
                } catch (err) {
                    console.error('[LOG EVENT ERROR] Al enviar log:', err);
                }
            } else {
                console.error('[LOG EVENT ERROR] logChannel no es de texto o es null');
            }
        } else {
            console.error('[LOG EVENT ERROR] logChannelId no definido');
        }
    } catch (e) {
        console.error('[LOG EVENT ERROR] Error general en guildBanAdd:', e);
    }
};
