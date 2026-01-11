// PRUEBA DE ERROR V2 POR WEBHOOK
require('./Util/webhookError').sendErrorToWebhook('Error de prueba V2', 'console.log("¡Funciona el V2!")');

const { Client, IntentsBitField } = require("discord.js");
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

require('./Util/silentDotenv')();

const { restoreTimers } = require('./Util/timerStorage');
restoreTimers();

// ...existing code...
// Notificación visual de apagado (shutdown) modular
const { setupShutdownHandler } = require("./Util/shutdownHandler");
const channelId = process.env.ERROR_CHANNEL_ID || '1459913736050704485';
setupShutdownHandler(client, channelId);
// ...existing code...

const moxi = require('./i18n');
client.translate = (key, lang, vars = {}) => moxi.translate(key, lang, vars);



module.exports = client;

require("colors");
require("./Handlers");
require("./anticrash/antiCrash.js")();

client.login(process.env.TOKEN);