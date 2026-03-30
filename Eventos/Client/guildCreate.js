// Evento: El bot entra a un servidor nuevo
const { EmbedBuilder } = require('discord.js');
const { sendDiscordWebhook } = require('../../Util/webhookSend');

module.exports = async (guild) => {
    console.log('[DEBUG][guildCreate] Evento disparado en guild:', guild.id, guild.name);
    const webhookUrl = process.env.GUILD_ACTIVITY_WEBHOOK_URL;
    const fallbackChannelId = process.env.GUILD_ACTIVITY_LOG_CHANNEL_ID;
    const webhookName = process.env.GUILD_ACTIVITY_WEBHOOK_NAME || 'Invitaciones Bot';
    const webhookAvatar = process.env.GUILD_ACTIVITY_WEBHOOK_AVATAR_URL || guild.client.user?.displayAvatarURL?.() || undefined;
    const webhookMention = process.env.GUILD_ACTIVITY_WEBHOOK_MENTION || `@${guild.client.user?.username || 'MoxiBot'}`;

    const embed = new EmbedBuilder()
        .setColor(0x39d353)
        .setTitle('Bot invitado a un servidor')
        .setDescription(`El servidor **${guild.name}** ha invitado al bot.`)
        .addFields(
            { name: 'Servidor', value: guild.name || 'Desconocido', inline: true },
            { name: 'Guild ID', value: guild.id || 'N/A', inline: true },
            { name: 'Miembros', value: String(guild.memberCount ?? 0), inline: true },
            { name: 'Owner', value: guild.ownerId || 'N/A', inline: false }
        )
        .setThumbnail(guild.iconURL({ size: 256 }) || null)
        .setTimestamp();

    if (webhookUrl) {
        await sendDiscordWebhook(webhookUrl, {
            username: webhookName,
            avatar_url: webhookAvatar,
            content: webhookMention,
            embeds: [embed.toJSON()],
        });
        console.log('[DEBUG][guildCreate] Aviso enviado por webhook configurable.');
        return;
    }

    if (!fallbackChannelId) {
        console.log('[DEBUG][guildCreate] Sin webhook ni canal fallback configurado.');
        return;
    }

    const logChannel = guild.client.channels.cache.get(fallbackChannelId);
    if (!logChannel) {
        console.log('[DEBUG][guildCreate] Canal de logs no encontrado:', fallbackChannelId);
        return;
    }

    await logChannel.send({ embeds: [embed] });
    console.log('[DEBUG][guildCreate] Aviso enviado al canal fallback.');
};
