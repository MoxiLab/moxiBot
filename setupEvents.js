// setupEvents.js
// Registra todos los eventos de Discord Client de la carpeta Eventos/Client

const client = require('./index');
const path = require('path');
const fs = require('fs');

// Lista de eventos válidos de Discord.js (puedes ampliarla si usas más)
const validEvents = [
    // Compat v14/v15
    // En v14 'ready' está deprecado (y genera warning). Usamos siempre 'clientReady'.
    'clientReady',
    'channelCreate', 'channelDelete', 'channelUpdate',
    'emojiCreate', 'emojiDelete', 'emojiUpdate',
    'guildBanAdd', 'guildBanRemove',
    'guildMemberAdd', 'guildMemberRemove', 'guildMemberUpdate',
    'messageCreate', 'messageDelete', 'messageDeleteBulk', 'messageBulkDelete', 'messageUpdate',
    'roleCreate', 'roleDelete', 'roleUpdate',
    // invites
    'inviteCreate', 'inviteDelete', 'inviteUpdate',
    // ...agrega más si usas otros eventos
];



function registerEventsRecursive(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            registerEventsRecursive(fullPath);
        } else if (file.endsWith('.js')) {
            const fileEventName = file.replace('.js', '');
            const eventHandler = require(fullPath);
            if (typeof eventHandler === 'function') {
                const auditLogDebug = require('./Util/auditLogDebug');

                // Compat: mantenemos el archivo ready.js pero lo registramos como clientReady.
                const eventName = fileEventName === 'ready' ? 'clientReady' : fileEventName;
                if (validEvents.includes(eventName)) {
                    const onFn = eventName === 'clientReady' ? client.once.bind(client) : client.on.bind(client);
                    onFn(eventName, (...args) => {
                        auditLogDebug(eventName, `Evento '${eventName}' disparado`);
                        eventHandler(...args);
                    });
                }
            }
        }
    });
}

const eventsDir = path.join(__dirname, 'Eventos', 'Client');
registerEventsRecursive(eventsDir);
