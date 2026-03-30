const { PermissionsBitField } = require('discord.js');
const moxi = require('../../i18n');

module.exports = {
    name: 'rol',
    alias: ['rol'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    description: 'Gestiona roles: crear, borrar, editar, asignar, quitar.',
    usage: 'rol <crear|borrar|editar|asignar|quitar> <nombre> [opciones]',
    async execute(client, message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply('No tienes permisos para gestionar roles.');
        }
        const accion = args[0];
        const nombre = args[1];
        const guild = message.guild;
        if (!accion || !nombre) return message.reply('Uso: rol <crear|borrar|editar|asignar|quitar> <nombre>');
        if (accion === 'crear') {
            const color = args[2] || 'Default';
            await guild.roles.create({ name: nombre, color });
            return message.reply(`Rol creado: ${nombre}`);
        } else if (accion === 'borrar') {
            const rol = guild.roles.cache.find(r => r.name === nombre);
            if (!rol) return message.reply('No se encontró el rol.');
            await rol.delete();
            return message.reply(`Rol borrado: ${nombre}`);
        } else if (accion === 'editar') {
            const rol = guild.roles.cache.find(r => r.name === nombre);
            if (!rol) return message.reply('No se encontró el rol.');
            const nuevoNombre = args[2];
            const nuevoColor = args[3];
            if (nuevoNombre) await rol.setName(nuevoNombre);
            if (nuevoColor) await rol.setColor(nuevoColor);
            return message.reply(`Rol editado: ${nuevoNombre || nombre}`);
        } else if (accion === 'asignar') {
            const miembro = message.mentions.members.first();
            const rol = guild.roles.cache.find(r => r.name === nombre);
            if (!miembro || !rol) return message.reply('No se encontró el miembro o el rol.');
            await miembro.roles.add(rol);
            return message.reply(`Rol asignado a ${miembro.user.tag}`);
        } else if (accion === 'quitar') {
            const miembro = message.mentions.members.first();
            const rol = guild.roles.cache.find(r => r.name === nombre);
            if (!miembro || !rol) return message.reply('No se encontró el miembro o el rol.');
            await miembro.roles.remove(rol);
            return message.reply(`Rol quitado a ${miembro.user.tag}`);
        }
    }
};