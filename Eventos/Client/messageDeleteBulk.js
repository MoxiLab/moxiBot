const { buildLogEventEmbed } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (messages) => {
    if (isFlagEnabled('messageDeleteBulk')) console.log('[MESSAGEDELETEBULK_DEBUG] Ejecutado: messageDeleteBulk');
    if (!Array.isArray(messages) || messages.length === 0) return;
    const firstMsg = messages[0];
    if (!firstMsg.guild) return;
    // Debug extra para comparar con messageUpdate
    if (isFlagEnabled('messageDeleteBulk')) {
        console.log('[MESSAGEDELETEBULK_DEBUG] guildID:', firstMsg.guild.id);
    }
    try {
        const guildDoc = await Guild.findOne({ guildID: firstMsg.guild.id }).lean();
        if (isFlagEnabled('messageDeleteBulk')) {
            console.log('[MESSAGEDELETEBULK_DEBUG] logChannelID en DB:', guildDoc?.logChannelID);
        }
        const logChannelId = guildDoc?.logChannelID;
        if (isFlagEnabled('messageDeleteBulk')) {
            console.log('[MESSAGEDELETEBULK_DEBUG] El embed se enviará al canal con ID:', logChannelId);
        }
        if (logChannelId) {
            const logChannel = await firstMsg.guild.channels.fetch(logChannelId).catch((err) => { console.error('[LOG EVENT ERROR] Al buscar canal:', err); return null; });
            if (logChannel && logChannel.isTextBased()) {
                const count = messages.length;
                const users = [...new Set(messages.map(m => m.author?.username).filter(Boolean))].join(', ');
                const channels = [...new Set(messages.map(m => `<#${m.channel.id}>`))].join(', ');
                const embed = buildLogEventEmbed({
                    type: 'delete',
                    user: users || 'Varios',
                    oldContent: `Se eliminaron ${count} mensajes en ${channels}.`,
                    channel: channels,
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
        console.error('[LOG EVENT ERROR] Error general en messageDeleteBulk:', e);
    }
};
