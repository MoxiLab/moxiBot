// PRUEBA DE ERROR V2 POR WEBHOOK
require('./Util/webhookError').sendErrorToWebhook('Error de prueba V2', 'console.log("¡Funciona el V2!")');

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
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ]
});

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


require("colors");
require("./Handlers");
require("./setupEvents.js");
require("./anticrash/antiCrash.js")();

client.login(process.env.TOKEN);