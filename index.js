
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


const moxi = require('./i18n');
client.translate = (key, lang, vars = {}) => moxi.translate(key, lang, vars);

module.exports = client;

require("colors");
require("./Handlers");
require("./anticrash/antiCrash.js")();

client.login(process.env.TOKEN);