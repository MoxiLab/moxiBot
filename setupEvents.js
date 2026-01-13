// setupEvents.js
// Registra todos los eventos de Discord Client de la carpeta Eventos/Client

const client = require('./index');
const path = require('path');
const fs = require('fs');

// Lista de eventos válidos de Discord.js (puedes ampliarla si usas más)
const validEvents = [
    'ready',
    'channelCreate', 'channelDelete', 'channelUpdate',
    'emojiCreate', 'emojiDelete', 'emojiUpdate',
    'guildBanAdd', 'guildBanRemove',
    'guildMemberAdd', 'guildMemberRemove', 'guildMemberUpdate',
    'messageCreate', 'messageDelete', 'messageDeleteBulk', 'messageBulkDelete', 'messageUpdate',
    'roleCreate', 'roleDelete', 'roleUpdate',
    // ...agrega más si usas otros eventos
];



function registerEventsRecursive(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            registerEventsRecursive(fullPath);
        } else if (file.endsWith('.js')) {
            const eventName = file.replace('.js', '');
            const eventHandler = require(fullPath);
            if (typeof eventHandler === 'function' && validEvents.includes(eventName)) {
                const auditLogDebug = require('./Util/auditLogDebug');
                client.on(eventName, (...args) => {
                    auditLogDebug(eventName, `Evento '${eventName}' disparado`);
                    eventHandler(...args);
                });
            }
        }
    });
}

const eventsDir = path.join(__dirname, 'Eventos', 'Client');
registerEventsRecursive(eventsDir);
