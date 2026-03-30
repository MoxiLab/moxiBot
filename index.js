// Diagnóstico opcional: mostrar quién fuerza la salida del proceso.
if (process.env.TRACE_PROCESS_EXIT === '1') {
    const originalExit = process.exit;
    process.exit = (code) => {
        const c = (code === undefined ? 0 : code);
        // eslint-disable-next-line no-console
        console.error('[TRACE_PROCESS_EXIT] process.exit called with', c);
        // eslint-disable-next-line no-console
        console.error(new Error('[TRACE_PROCESS_EXIT] stack').stack);
        return originalExit.call(process, c);
    };

    process.on('beforeExit', (code) => {
        // eslint-disable-next-line no-console
        console.error('[TRACE_PROCESS_EXIT] beforeExit', code);
    });
    process.on('exit', (code) => {
        // eslint-disable-next-line no-console
        console.error('[TRACE_PROCESS_EXIT] exit', code);
    });
}

// Cargar .env y configuración de red (Undici) lo antes posible.
require('./Util/silentDotenv')();

const { Client, GatewayIntentBits } = require("discord.js");
const { ContainerBuilder, MessageFlags } = require('discord.js');
const { Bot } = require('./Config');

const disablePrivilegedIntents = ['1', 'true', 'yes', 'on'].includes(String(process.env.DISABLE_PRIVILEGED_INTENTS || '').trim().toLowerCase());

const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
];

if (!disablePrivilegedIntents) {
    intents.push(GatewayIntentBits.MessageContent);
    intents.push(GatewayIntentBits.GuildMembers);
}

const client = new Client({ intents });

// Evita que el proceso caiga por eventos "error" no manejados del WS.
try {
    const logger = require('./Util/logger');
    const onDisallowedIntents = (err) => {
        const msg = (err && err.message) ? String(err.message) : '';
        if (!msg.includes('Used disallowed intents')) return false;

        logger.error('[Discord] Used disallowed intents.');
        logger.error('[Discord] Solución: habilita los intents privilegiados en el Developer Portal -> Bot:');
        logger.error('- MESSAGE CONTENT INTENT (si usas comandos por prefijo / lee mensajes)');
        logger.error('- SERVER MEMBERS INTENT (si usas member events, levels, auditoría, etc.)');
        logger.error('[Discord] Alternativa temporal: pon DISABLE_PRIVILEGED_INTENTS=1 en .env (romperá funciones que dependen de esos intents).');
        return true;
    };

    client.on('error', (err) => {
        if (onDisallowedIntents(err)) return;
        logger.error('[Discord] Client error:', err);
    });
    client.on('shardError', (err) => {
        if (onDisallowedIntents(err)) return;
        logger.error('[Discord] Shard error:', err);
    });

    // discord.js expone client.ws (WebSocketManager). Si no hay listener, Node puede tirar el proceso.
    if (client.ws && typeof client.ws.on === 'function') {
        client.ws.on('error', (err) => {
            if (onDisallowedIntents(err)) return;
            logger.error('[Discord] WS error:', err);
        });
    }
} catch {
    // best-effort
}

// Compat discord.js: `ephemeral` está deprecado, usamos flags internamente.
require('./Util/discordEphemeralCompat').installEphemeralCompat();

// Timers: se restauran tras el evento ready (cuando Mongo ya está conectado)

// Reminders de cooldown (Economy)
try {
    const { restoreCooldownReminders } = require('./Util/cooldownReminders');
    restoreCooldownReminders(client).catch(() => null);
} catch {
    // best-effort
}

// Notificación visual de apagado (shutdown) modular
const { setupShutdownHandler } = require("./Util/shutdownHandler");
const channelId = process.env.ERROR_CHANNEL_ID || '1459913736050704485';
setupShutdownHandler(client, channelId);

const moxi = require('./i18n');
client.translate = (key, lang, vars = {}) => moxi.translate(key, lang, vars);

module.exports = client;

require('colors');

// Importante: cargar handlers/eventos DESPUÉS de exportar el client,
// para evitar dependencias circulares (eventos hacen require("../index")).
require('./Handlers');
require('./setupEvents.js');
require('./anticrash/antiCrash.js')();

const discordToken = (process.env.TOKEN && String(process.env.TOKEN).trim())
    ? String(process.env.TOKEN).trim()
    : ((process.env.DISCORD_TOKEN && String(process.env.DISCORD_TOKEN).trim()) ? String(process.env.DISCORD_TOKEN).trim() : '');

if (!discordToken) {
    // eslint-disable-next-line no-console
    console.error('[FATAL] Falta el token de Discord. Configura TOKEN (o DISCORD_TOKEN) en el .env');
    process.exit(1);
}

client.login(discordToken);