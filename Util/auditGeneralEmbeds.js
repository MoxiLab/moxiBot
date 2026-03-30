// Plantillas V2 para logs de eventos de usuario y servidor
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
const GENERAL_COLOR = 0xA259FF;
const GENERAL_ICON = 'https://cdn.discordapp.com/emojis/802917097851469834.png';

function memberRemoveEmbed({ userId, timeStr }) {
    return new ContainerBuilder()
        .setAccentColor(GENERAL_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🔴 Usuario salió del servidor`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`El usuario <@${userId}> ha salido del servidor.`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
}

function channelCreateEmbed({ channelId, timeStr }) {
    return new ContainerBuilder()
        .setAccentColor(GENERAL_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🟢 Canal creado`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Se ha creado el canal <#${channelId}>.`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
}

function channelDeleteEmbed({ channelName, timeStr }) {
    return new ContainerBuilder()
        .setAccentColor(GENERAL_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ⚫ Canal eliminado`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Se ha eliminado el canal: ${channelName}.`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
}

function messageDeleteEmbed({ userId, channelId, timeStr }) {
    return new ContainerBuilder()
        .setAccentColor(GENERAL_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🟠 Mensaje eliminado`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Un mensaje de <@${userId}> fue eliminado en <#${channelId}>.`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
}

function guildUpdateEmbed({ oldName, newName, timeStr }) {
    return new ContainerBuilder()
        .setAccentColor(GENERAL_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🟣 Servidor actualizado`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Nombre anterior: ${oldName}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Nombre nuevo: ${newName}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
}

module.exports = {
    memberRemoveEmbed,
    channelCreateEmbed,
    channelDeleteEmbed,
    messageDeleteEmbed,
    guildUpdateEmbed,
};
