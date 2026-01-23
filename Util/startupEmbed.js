const { EmbedBuilder } = require('discord.js');
const { isTestMode } = require('./runtimeMode');

/** 
 * Envía un embed de arranque al canal especificado.
 * @param {import('discord.js').Client} client - Instancia del cliente de Discord
 */
async function sendStartupEmbed(client) {
    if (isTestMode()) return;

    const channelId = process.env.STARTUP_CHANNEL_ID || process.env.STATUS_CHANNEL_ID;
    if (!channelId) return;
    const color = process.env.BOT_ACCENT_COLOR ? process.env.BOT_ACCENT_COLOR.replace(/^0x/i, '#') : '#E1A6FF';

    // Datos del bot
    const botTag = client.user?.tag || 'Moxi';
    const botId = client.user?.id || '';
    const guilds = client.guilds?.cache?.size || 0;
    const fecha = `<t:${Math.floor(Date.now() / 1000)}:f>`;

    let embed = new EmbedBuilder()
        .setTitle('💜 Moxi encendido')
        .setColor(color)
        .setDescription(`Moxi se inició como **${botTag}**`)
        .addFields(
            { name: 'Gremios', value: guilds.toString(), inline: true },
            { name: 'Fecha', value: fecha, inline: false },
        )
        .setFooter({ text: `ID: ${botId}` })
        .setTimestamp();

    try {
        const channel = await client.channels.fetch(channelId); 
        if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] });
        }
    } catch (err) {
        // Si falla, loguea el error pero no detiene el arranque
        console.error('No se pudo enviar el embed de arranque:', err);
    }
}

module.exports = { sendStartupEmbed };