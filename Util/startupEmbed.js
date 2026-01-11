const { EmbedBuilder } = require('discord.js');
require('dotenv').config();

function formatUptime(ms) {
    const sec = Math.floor((ms / 1000) % 60);
    const min = Math.floor((ms / (1000 * 60)) % 60);
    const hr = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const d = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${d > 0 ? d + 'd ' : ''}${hr > 0 ? hr + 'h ' : ''}${min > 0 ? min + 'm ' : ''}${sec}s`;
}

/**
 * Envía un embed de arranque al canal especificado.
 * @param {import('discord.js').Client} client - Instancia del cliente de Discord
 */
async function sendStartupEmbed(client) {
    const channelId = process.env.ERROR_CHANNEL_ID || '1459913736050704485';
    const color = process.env.BOT_ACCENT_COLOR ? process.env.BOT_ACCENT_COLOR.replace(/^0x/i, '#') : '#E1A6FF';

    // Datos del bot
    const botTag = client.user?.tag || 'Moxi';
    const botId = client.user?.id || '';
    const guilds = client.guilds?.cache?.size || 0;
    const uptime = formatUptime(client.uptime || 0);
    const fecha = `<t:${Math.floor(Date.now() / 1000)}:f>`;

    const embed = new EmbedBuilder()
        .setTitle('💜 Moxi encendido')
        .setColor(color)
        .setDescription(`Moxi se inició como **${botTag}**`)
        .addFields(
            { name: 'Gremios', value: guilds.toString(), inline: true },
            { name: 'Uptime', value: uptime, inline: true },
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