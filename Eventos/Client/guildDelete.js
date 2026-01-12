// Evento: El bot sale de un servidor
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');

module.exports = async (guild) => {
    console.log('[DEBUG][guildDelete] Evento disparado en guild:', guild.id, guild.name);
    const LOG_CHANNEL_ID = '1460414202777833665';
    const logChannel = guild.client.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) {
        console.log('[DEBUG][guildDelete] Canal de logs no encontrado:', LOG_CHANNEL_ID);
        return;
    }

    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const container = new ContainerBuilder()
        .setAccentColor(0xff5555)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ MoxiBot eliminado de un servidor`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Servidor: **${guild.name}**`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`ID: ${guild.id}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Miembros: ${guild.memberCount}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Propietario: <@${guild.ownerId}>`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));

    await logChannel.send({ content: '', components: [container] });
    console.log('[DEBUG][guildDelete] Embed enviado al canal de logs.');
};
