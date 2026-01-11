const { ContainerBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Bot } = require('../../Config');

function formatUptime(ms) {
    const sec = Math.floor((ms / 1000) % 60);
    const min = Math.floor((ms / (1000 * 60)) % 60);
    const hr = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const d = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${d > 0 ? d + 'd ' : ''}${hr > 0 ? hr + 'h ' : ''}${min > 0 ? min + 'm ' : ''}${sec}s`;
}

/**
 * Genera un componente V2 de apagado bonito para Moxi, estilo ping pero sin botón
 * @param {import('discord.js').Client} client
 * @returns {ContainerBuilder}
 */

function getShutdownComponentV2(client) {
    const botTag = client.user?.tag || 'Moxi';
    const botId = client.user?.id || '';
    const guilds = client.guilds?.cache?.size || 0;
    const uptime = formatUptime(client.uptime || 0);
    const fecha = `<t:${Math.floor(Date.now() / 1000)}:f>`;
    // Heurística de entorno
    let entorno = '💻 Local';
    const hostIp = process.env.BOT_HOST_IP || '';
    if (
        process.env.HOST_ENV === 'true' || process.env.HOST_ENV === '1' ||
        process.env.IS_HOST === 'true' || process.env.IS_HOST === '1' ||
        process.env.PWD?.includes('/home') ||
        process.env.USER === 'container' ||
        process.env.PM2_HOME ||
        process.env.HOSTNAME ||
        process.env.RENDER || process.env.RAILWAY_STATIC_URL || process.env.VERCEL ||
        process.env.NODE_ENV === 'production' ||
        hostIp === '216.173.77.175:8801'
    ) {
        entorno = '🌐 Host';
    }

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c =>
            c.setContent(`# 💔 Moxi apagado`)
        )
        .addTextDisplayComponents(c =>
            c.setContent(`> Moxi se apagó como **${botTag}**`)
        )
        .addTextDisplayComponents(c =>
            c.setContent(`> **Entorno:** ${entorno}`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`📊 **Gremios:** ${guilds}\n⏱️ **Uptime final:** ${uptime}`)
        )
        .addTextDisplayComponents(c =>
            c.setContent(`🗓️ **Fecha:** ${fecha}`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`© Moxi • ID: ${botId}`)
        )
        .addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setLabel('Ir al server')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://panel.bernini.me/server/1e3f6120/console')
            )
        );

    return container;
}

module.exports = { getShutdownComponentV2 };