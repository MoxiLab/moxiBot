

const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

// Funciones de eventos de mensajes
function messageDeleteEmbed({ authorId, channelId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0xffa500)
        .addTextDisplayComponents(c => c.setContent(`# 🟠 Mensaje eliminado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Un mensaje de <@${authorId}> fue eliminado en <#${channelId}>.`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`🕒 ${timeStr}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent('© MoxiBot • 2026'));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function messageBulkDeleteEmbed({ channelId, count, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0xff5555)
        .addTextDisplayComponents(c => c.setContent(`# Mensajes eliminados masivamente`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se han eliminado **${count}** mensajes en <#${channelId}>.`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function stickerCreateEmbed({ name, id, format, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(c => c.setContent(`# Sticker creado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha creado el sticker **${name}** (ID: ${id}, formato: ${format}).`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ...resto de funciones...
function inviteDeleteEmbed({ code, inviterId, channelId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x23272A)
        .addTextDisplayComponents(c => c.setContent(`# Invitación eliminada`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha eliminado la invitación: \`${code}\` en <#${channelId}>`))
        .addTextDisplayComponents(c => c.setContent(`Invitador: ${inviterId ? `<@${inviterId}>` : 'Desconocido'}`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function inviteCreateEmbed({ code, inviterId, channelId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(c => c.setContent(`# Invitación creada`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha creado una invitación: \`${code}\` en <#${channelId}>`))
        .addTextDisplayComponents(c => c.setContent(`Invitador: ${inviterId ? `<@${inviterId}>` : 'Desconocido'}`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function messageBulkDeleteEmbed({ channelId, count, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0xff5555)
        .addTextDisplayComponents(c => c.setContent(`# Mensajes eliminados masivamente`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se han eliminado **${count}** mensajes en <#${channelId}>.`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function channelUpdateEmbed({ channelId, oldName, newName, oldType, newType, timeStr }) {
    let desc = '';
    if (oldName !== newName) desc += `**Nombre:** \`${oldName}\` → \`${newName}\`\n`;
    if (oldType !== newType) desc += `**Tipo:** \`${oldType}\` → \`${newType}\`\n`;
    if (!desc) desc = 'Se actualizó el canal, pero no se detectaron cambios relevantes.';
    const container = new ContainerBuilder()
        .setAccentColor(0xffcc00)
        .addTextDisplayComponents(c => c.setContent(`# Canal actualizado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(desc))
        .addTextDisplayComponents(c => c.setContent(`Canal: <#${channelId}>`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
function integrationUpdateEmbed({ oldName, newName, id, type, account, timeStr }) {
    let desc = '';
    if (oldName !== newName) desc += `**Nombre:** \`${oldName}\` → \`${newName}\`\n`;
    if (!desc) desc = 'Se actualizó la integración, pero no se detectaron cambios relevantes.';
    const container = new ContainerBuilder()
        .setAccentColor(0x57F287)
        .addTextDisplayComponents(c => c.setContent(`# Integración actualizada`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(desc))
        .addTextDisplayComponents(c => c.setContent(`ID: ${id}`))
        .addTextDisplayComponents(c => c.setContent(`Tipo: ${type}`))
        .addTextDisplayComponents(c => c.setContent(`Cuenta: ${account?.name || 'desconocida'}`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function integrationDeleteEmbed({ name, id, type, account, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x23272A)
        .addTextDisplayComponents(c => c.setContent(`# Integración eliminada`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha eliminado la integración **${name}** (ID: ${id}) de tipo **${type}** para la cuenta **${account?.name || 'desconocida'}**.`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function integrationCreateEmbed({ name, id, type, account, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(c => c.setContent(`# Integración creada`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha creado la integración **${name}** (ID: ${id}) de tipo **${type}** para la cuenta **${account?.name || 'desconocida'}**.`))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
// Embed para evento: Webhook actualizado
function webhookUpdateEmbed({ oldName, newName, id, oldChannelId, newChannelId, timeStr }) {
    let desc = '';
    if (oldName !== newName) desc += `**Nombre:** \`${oldName}\` → \`${newName}\`\n`;
    if (oldChannelId !== newChannelId) desc += `**Canal:** <#${oldChannelId}> → <#${newChannelId}>\n`;
    if (!desc) desc = 'Se actualizó el webhook, pero no se detectaron cambios relevantes.';
    const container = new ContainerBuilder()
        .setAccentColor(0xffcc00)
        .addTextDisplayComponents(c => c.setContent(`# Webhook actualizado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(desc))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`ID: ${id}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent('© MoxiBot • 2026'));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports.webhookUpdateEmbed = webhookUpdateEmbed;
// Embed para evento: Webhook eliminado
function webhookDeleteEmbed({ name, id, channelId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0xff5555)
        .addTextDisplayComponents(c => c.setContent(`# Webhook eliminado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha eliminado el webhook **${name}** (ID: ${id}) del canal <#${channelId}>.`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent('© MoxiBot • 2026'));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports.webhookDeleteEmbed = webhookDeleteEmbed;
// Embed para evento: Webhook creado
function webhookCreateEmbed({ name, id, channelId, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0x77dd77)
        .addTextDisplayComponents(c => c.setContent(`# Webhook creado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha creado el webhook **${name}** (ID: ${id}) en el canal <#${channelId}>.`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent('© MoxiBot • 2026'));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports.webhookCreateEmbed = webhookCreateEmbed;
// Embed para evento: Emoji actualizado
function emojiUpdateEmbed({ oldName, newName, id, animated, timeStr }) {
    const url = animated
        ? `https://cdn.discordapp.com/emojis/${id}.gif`
        : `https://cdn.discordapp.com/emojis/${id}.png`;
    let desc = '';
    if (oldName !== newName) desc += `**Nombre:** \`${oldName}\` → \`${newName}\`\n`;
    if (!desc) desc = 'Se actualizó el emoji, pero no se detectaron cambios relevantes.';
    const container = new ContainerBuilder()
        .setAccentColor(0xffcc00)
        .addTextDisplayComponents(c => c.setContent(`# Emoji actualizado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(desc))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`ID: ${id}`))
        .addTextDisplayComponents(c => c.setContent(`URL: ${url}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent('© MoxiBot • 2026'));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports.emojiUpdateEmbed = emojiUpdateEmbed;
// Embed para evento: Emoji eliminado
function emojiDeleteEmbed({ name, id, animated, timeStr }) {
    const url = animated
        ? `https://cdn.discordapp.com/emojis/${id}.gif`
        : `https://cdn.discordapp.com/emojis/${id}.png`;
    const container = new ContainerBuilder()
        .setAccentColor(0xff5555)
        .addTextDisplayComponents(c => c.setContent(`# Emoji eliminado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha eliminado el emoji **${name}** (${animated ? 'Animado' : 'Estático'}).`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`ID: ${id}`))
        .addTextDisplayComponents(c => c.setContent(`URL: ${url}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent('© MoxiBot • 2026'));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports.emojiDeleteEmbed = emojiDeleteEmbed;
// Embed para evento: Emoji creado
function emojiCreateEmbed({ name, id, animated, timeStr }) {
    const url = animated
        ? `https://cdn.discordapp.com/emojis/${id}.gif`
        : `https://cdn.discordapp.com/emojis/${id}.png`;
    const container = new ContainerBuilder()
        .setAccentColor(0x77dd77)
        .addTextDisplayComponents(c => c.setContent(`# Emoji creado`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Se ha creado el emoji **${name}** (${animated ? 'Animado' : 'Estático'}).`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`ID: ${id}`))
        .addTextDisplayComponents(c => c.setContent(`URL: ${url}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent('© MoxiBot • 2026'));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports.emojiCreateEmbed = emojiCreateEmbed;
// Embed para evento: Rol actualizado
function roleUpdateEmbed({ oldName, newName, oldColor, newColor, oldPerms, newPerms, timeStr }) {
    let desc = '';
    if (oldName !== newName) desc += `**Nombre:** \`${oldName}\` → \`${newName}\`\n`;
    if (oldColor !== newColor) desc += `**Color:** \`${oldColor}\` → \`${newColor}\`\n`;
    if (oldPerms.bitfield !== newPerms.bitfield) desc += `**Permisos:** \`${oldPerms.bitfield}\` → \`${newPerms.bitfield}\`\n`;
    if (!desc) desc = 'Se actualizó el rol, pero no se detectaron cambios relevantes.';
    return new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle('Rol actualizado')
        .setDescription(desc)
        .setFooter({ text: `Evento: ROLE_UPDATE | ${timeStr}` });
}

module.exports.roleUpdateEmbed = roleUpdateEmbed;
// Embed para evento: Rol eliminado

function roleDeleteEmbed({ roleName, timeStr }) {
    const container = new ContainerBuilder()
        .setAccentColor(0xff5555)
        .addTextDisplayComponents(c =>
            c.setContent(`# Rol eliminado`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`El rol **${roleName}** ha sido eliminado.`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`Fecha: ${timeStr}`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent('© MoxiBot • 2026')
        );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}


module.exports = {
    messageDeleteEmbed,
    roleDeleteEmbed,
    emojiDeleteEmbed,
    emojiUpdateEmbed,
    webhookCreateEmbed,
    webhookDeleteEmbed,
    webhookUpdateEmbed,
};
