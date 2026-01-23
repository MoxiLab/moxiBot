// Plantilla para logs informativos de permisos
// Plantilla V2 para logs informativos de permisos insuficientes
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');
const PERM_COLOR = 0xFEE75C;
const PERM_ICON = 'https://cdn.discordapp.com/emojis/802917097851469834.png';

function permissionInfoEmbed({ moderatorId, reason, timeStr }) {
    return new ContainerBuilder()
        .setAccentColor(PERM_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ⚠️ Permisos insuficientes`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Intento de acción administrativa fallido por permisos insuficientes.`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Usuario: ${moderatorId ? `<@${moderatorId}>` : '-'}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Motivo: ${reason || 'No especificado'}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🕒 ${timeStr}`));
}

module.exports = {
    permissionInfoEmbed,
};
