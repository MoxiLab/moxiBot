const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'permiso',
    alias: ['permiso', 'perms'],
    description: 'Edita permisos de canales, roles y miembros.',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    usage: 'permiso <canal|rol|miembro> <nombre> <permiso> <permitir|denegar>',
    async execute(client, message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('No tienes permisos de administrador.');
        }
        const tipo = args[0];
        const nombre = args[1];
        const permiso = args[2];
        const accion = args[3];
        const guild = message.guild;
        if (!tipo || !nombre || !permiso || !accion) return message.reply('Uso: permiso <canal|rol|miembro> <nombre> <permiso> <permitir|denegar>');
        if (tipo === 'canal') {
            const canal = guild.channels.cache.find(c => c.name === nombre);
            if (!canal) return message.reply('No se encontró el canal.');
            await canal.permissionOverwrites.edit(message.guild.id, { [permiso]: accion === 'permitir' });
            return message.reply(`Permiso ${permiso} ${accion} en canal ${nombre}`);
        } else if (tipo === 'rol') {
            const rol = guild.roles.cache.find(r => r.name === nombre);
            if (!rol) return message.reply('No se encontró el rol.');
            await rol.setPermissions([permiso]);
            return message.reply(`Permiso ${permiso} asignado al rol ${nombre}`);
        } else if (tipo === 'miembro') {
            const miembro = message.mentions.members.first();
            if (!miembro) return message.reply('Menciona al miembro.');
            await miembro.permissions.add(permiso);
            return message.reply(`Permiso ${permiso} asignado a ${miembro.user.tag}`);
        }
    }
};