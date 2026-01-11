const { ContainerBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Bot } = require('../../Config');

/**
 * Genera un container V2 para logs de eventos de Discord (entradas, salidas, ediciones, etc.)
 * @param {Object} options
 * @param {string} options.type - Tipo de evento: 'join', 'leave', 'edit', 'delete', etc.
 * @param {string} options.user - Nombre del usuario afectado
 * @param {string} [options.avatarURL] - URL del avatar del usuario
 * @param {string} [options.extra] - Texto extra (motivo, cambios, etc.)
 * @param {string} [options.oldContent] - Contenido anterior (para ediciones)
 * @param {string} [options.newContent] - Contenido nuevo (para ediciones)
 * @param {string} [options.channel] - Canal afectado
 * @param {Date} [options.timestamp] - Fecha/hora del evento
 */
function buildLogEventContainer(options) {
    const {
        type = 'info',
        user = 'Usuario',
        avatarURL = null,
        extra = '',
        oldContent = '',
        newContent = '',
        channel = '',
        timestamp = new Date()
    } = options;

    let color = 0xE1A6FF;
    let title = 'Evento';
    let emoji = 'ℹ️';
    if (type === 'join') { color = 0x57F287; title = 'Usuario entró'; emoji = '🟢'; }
    if (type === 'leave') { color = 0xED4245; title = 'Usuario salió'; emoji = '🔴'; }
    if (type === 'edit') { color = 0xFEE75C; title = 'Mensaje editado'; emoji = '✏️'; }
    if (type === 'delete') { color = 0xED4245; title = 'Mensaje eliminado'; emoji = '🗑️'; }

    const container = new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(c =>
            c.setContent(`# ${emoji} ${title}`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => {
            let content = `**Usuario:** ${user}`;
            if (channel) content += `\n**Canal:** ${channel}`;
            if (type === 'edit' && oldContent && newContent) {
                content += `\n**Antes:**\n${oldContent}\n**Después:**\n${newContent}`;
            }
            if (extra) content += `\n${extra}`;
            return c.setContent(content);
        })
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`${timestamp.toLocaleString('es-ES')} • ${Bot.Name}`)
        );

    return container;
}

module.exports = { buildLogEventContainer };
