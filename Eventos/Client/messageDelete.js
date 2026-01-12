const { buildLogEventEmbed } = require('../../Components/V2/logEvent');
const Guild = require('../../Models/GuildSchema');
const { isFlagEnabled } = require('../../Util/debug');

module.exports = async (message) => {
    if (!message.guild || message.author?.bot) return;
    if (isFlagEnabled('messageDelete')) console.log('[MESSAGEDELETE_DEBUG] Ejecutado: messageDelete');
    // Debug extra para comparar con messageUpdate
    if (isFlagEnabled('messageDelete')) {
        console.log('[MESSAGEDELETE_DEBUG] guildID:', message.guild.id);
    }
    try {
        const guildDoc = await Guild.findOne({ guildID: message.guild.id }).lean();
        if (isFlagEnabled('messageDelete')) {
            console.log('[MESSAGEDELETE_DEBUG] logChannelID en DB:', guildDoc?.logChannelID);
        }
        const logChannelId = guildDoc?.logChannelID;
        if (logChannelId) {
            const logChannel = await message.guild.channels.fetch(logChannelId).catch((err) => { console.error('[LOG EVENT ERROR] Al buscar canal:', err); return null; });
            if (logChannel && logChannel.isTextBased()) {
                const embed = buildLogEventEmbed({
                    type: 'delete',
                    user: `${message.author?.username || 'Desconocido'}`,
                    oldContent: message.content || '(sin contenido)',
                    channel: message.channel ? `<#${message.channel.id}>` : 'Desconocido',
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
        console.error('[LOG EVENT ERROR] Error general en messageDelete:', e);
    }
};
