// setupEvents.js
// Registra todos los eventos de Discord Client de la carpeta Eventos/Client

const client = require('./index');
const path = require('path');
const fs = require('fs');

// Lista de eventos válidos de Discord.js (puedes ampliarla si usas más)
const validEvents = [
    'channelCreate', 'channelDelete', 'channelUpdate',
    'emojiCreate', 'emojiDelete', 'emojiUpdate',
    'guildBanAdd', 'guildBanRemove',
    'guildMemberAdd', 'guildMemberRemove', 'guildMemberUpdate',
    'messageCreate', 'messageDelete', 'messageDeleteBulk', 'messageUpdate',
    'roleCreate', 'roleDelete', 'roleUpdate',
    // ...agrega más si usas otros eventos
];

const eventsDir = path.join(__dirname, 'Eventos', 'Client');

fs.readdirSync(eventsDir).forEach(file => {
    if (!file.endsWith('.js')) return;
    const eventName = file.replace('.js', '');
    const eventHandler = require(path.join(eventsDir, file));
    if (typeof eventHandler === 'function') {
        if (validEvents.includes(eventName)) {
            client.on(eventName, eventHandler); 
        } else {
            return;
        }
    }
});
