// setupEvents.js
// Registra eventos de Discord Client desde Eventos/Client

const path = require('path');
const fs = require('fs');

function registerEventsRecursive(client, dir) {
    if (!fs.existsSync(dir)) return;

    for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            registerEventsRecursive(client, fullPath);
            continue;
        }

        if (!file.endsWith('.js')) continue;

        const fileEventName = file.replace(/\.js$/i, '');
        const eventHandler = require(fullPath);
        if (typeof eventHandler !== 'function') continue;

        const auditLogDebug = require('./Util/auditLogDebug');
        const eventName = fileEventName;
        const isOnce = eventName === 'ready';
        const onFn = isOnce ? client.once.bind(client) : client.on.bind(client);

        onFn(eventName, (...args) => {
            try {
                auditLogDebug(eventName, `Evento '${eventName}' disparado`);
            } catch {
                // noop
            }

            // Compat de firma:
            // - La mayoría de handlers exportan (arg1, arg2...)
            // - Algunos (p.ej. ready.js) exportan (client)
            // Si el handler parece esperar el client además de los args del evento, lo inyectamos.
            try {
                if (eventHandler.length === args.length + 1) return eventHandler(client, ...args);
                return eventHandler(...args);
            } catch (err) {
                // No reventar el proceso por un handler
                // eslint-disable-next-line no-console
                console.error(`❌ Error en handler de evento '${eventName}' (${fullPath}):`, err);
            }
        });
    }
}

module.exports = (client) => {
    const eventsDir = path.join(__dirname, 'Eventos', 'Client');
    registerEventsRecursive(client, eventsDir);
};
