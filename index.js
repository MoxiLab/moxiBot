// PRUEBA DE ERROR V2 POR WEBHOOK
require('./Util/webhookError').sendErrorToWebhook('Error de prueba V2', 'console.log("¡Funciona el V2!")');

// Cargar .env y configuración de red (Undici) lo antes posible.
require('./Util/silentDotenv')();

const { Client, IntentsBitField } = require("discord.js");
const { ContainerBuilder, MessageFlags } = require('discord.js');
const { Bot } = require('./Config');
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

const { restoreTimers } = require('./Util/timerStorage');
restoreTimers(async (guildId, channelId, userId, minutos) => {
    try {
        // En caso de que dispare antes del ready, intentamos igualmente.
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || typeof channel.send !== 'function') return;

        const done = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c => c.setContent(`⏰ <@${userId}> ¡Tu temporizador de ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} ha terminado!`));

        await channel.send({
            components: [done],
            flags: MessageFlags.IsComponentsV2,
        });
    } catch {
        // Silencioso para no romper el arranque.
    }
});

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