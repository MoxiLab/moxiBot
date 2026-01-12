const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'permiso',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    description: 'Gestiona permisos de roles y canales.',
    usage: 'permiso <rol|canal> <nombre> <añadir|quitar|ver> <permiso>',
    async execute(Moxi, message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('No tienes permisos para gestionar permisos.');
        }
        const tipo = args[0];
        const nombre = args[1];
        const accion = args[2];
        const permiso = args[3];
        const guild = message.guild;
        if (!tipo || !nombre || !accion) return message.reply('Uso: permiso <rol|canal> <nombre> <añadir|quitar|ver> <permiso>');
        if (tipo === 'rol') {
            const rol = guild.roles.cache.find(r => r.name === nombre);
            if (!rol) return message.reply('No se encontró el rol.');
            if (accion === 'ver') {
                return message.reply(`Permisos del rol ${nombre}: ${rol.permissions.toArray().join(', ')}`);
            } else if (accion === 'añadir') {
                if (!permiso) return message.reply('Debes indicar el permiso a añadir.');
                await rol.setPermissions([...rol.permissions, permiso]);
                return message.reply(`Permiso ${permiso} añadido al rol ${nombre}`);
            } else if (accion === 'quitar') {
                if (!permiso) return message.reply('Debes indicar el permiso a quitar.');
                await rol.setPermissions(rol.permissions.remove(permiso));
                return message.reply(`Permiso ${permiso} quitado al rol ${nombre}`);
            }
        } else if (tipo === 'canal') {
            const canal = guild.channels.cache.find(c => c.name === nombre);
            if (!canal) return message.reply('No se encontró el canal.');
            if (accion === 'ver') {
                return message.reply(`Permisos del canal ${nombre}: ${JSON.stringify(canal.permissionOverwrites.cache.map(po => ({ id: po.id, allow: po.allow.toArray(), deny: po.deny.toArray() })), null, 2)}`);
            } else if (accion === 'añadir' || accion === 'quitar') {
                if (!permiso) return message.reply('Debes indicar el permiso.');
                const rol = guild.roles.cache.find(r => r.name === args[4]);
                if (!rol) return message.reply('Debes indicar el nombre del rol para modificar el permiso.');
                let options = {};
                if (accion === 'añadir') options[permiso] = true;
                if (accion === 'quitar') options[permiso] = false;
                await canal.permissionOverwrites.edit(rol, options);
                return message.reply(`Permiso ${permiso} ${accion === 'añadir' ? 'añadido' : 'quitado'} en canal ${nombre} para el rol ${rol.name}`);
            }
        }
    }
};
