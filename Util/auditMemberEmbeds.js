
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const MEMBER_COLOR = 0xA259FF; // Morado NQN
const MEMBER_ICON = 'https://cdn.discordapp.com/emojis/802917097851469834.png';
const MEMBER_FOOTER = 'AuditLog • MoxiBot';

function memberJoinEmbed({ userId, timeStr, inviteLine }) {
    const container = new ContainerBuilder()
        .setAccentColor(MEMBER_COLOR)
        .addTextDisplayComponents(c => c.setContent(`# Nuevo usuario en el servidor`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`El usuario <@${userId}> se ha unido al servidor.`))
        .addTextDisplayComponents(c => inviteLine ? c.setContent(inviteLine) : c.setContent(''))
        .addTextDisplayComponents(c => c.setContent(`Fecha: ${timeStr}`))
        .addTextDisplayComponents(c => c.setContent(`${MEMBER_FOOTER}`));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {
    memberJoinEmbed,
};
