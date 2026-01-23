// Cargar .env y configuración de red (Undici) lo antes posible.
require('./Util/silentDotenv')();

const { isTestMode } = require('./Util/runtimeMode');

// Modo test: evita side-effects (logs/embeds/webhooks) al arrancar.
if (isTestMode()) {
    process.env.DISABLE_DISCORD_LOGS = '1';
}

const { Client, IntentsBitField } = require('discord.js');
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildVoiceStates
    ] 
});

// Compat discord.js: `ephemeral` está deprecado, usamos flags internamente.
require('./Util/discordEphemeralCompat').installEphemeralCompat();

if (!isTestMode()) {
    const { restoreTimers } = require('./Util/timerStorage');
    restoreTimers();

    // Notificación visual de apagado (shutdown) modular
    const { setupShutdownHandler } = require("./Util/shutdownHandler");
    const channelId = process.env.ERROR_CHANNEL_ID || '1459913287624949801';
    setupShutdownHandler(client, channelId);
}

const moxi = require('./i18n');
client.translate = (key, lang, vars = {}) => moxi.translate(key, lang, vars);

module.exports = client;

// En TEST_MODE evitamos arrancar el bot automáticamente (útil para scripts de verificación
// que solo hacen require de módulos). Si quieres iniciar el bot en test, ejecuta el entry
// con TEST_MODE=0 o añade tu propia rutina de arranque.
if (!isTestMode()) {
    require("colors");
    require("./Handlers");
    require("./setupEvents.js");
    require("./anticrash/antiCrash.js")();

    client.login(process.env.TOKEN);
}