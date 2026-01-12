const Moxi = require("../../index");
const { ActivityType } = require("discord.js");
const mongoose = require("mongoose");
const logger = require("../../Util/logger");
const { EMOJIS } = require("../../Util/emojis");
const Config = require("../../Config");



Moxi.once("clientReady", async () => {
    const moxi = require("../../i18n");
    const globalPrefix = (Array.isArray(Config?.Bot?.Prefix) && Config.Bot.Prefix[0])
        ? Config.Bot.Prefix[0]
        : (process.env.PREFIX || '.');

    // Helper para obtener textos según idioma (shard-aware)
    async function getStatusTexts(lang) {
        let totalGuilds = 0;
        let totalUsers = 0;
        if (Moxi.shard) {
            // Aggregate guild and user counts from all shards
            const guildCounts = await Moxi.shard.fetchClientValues('guilds.cache.size');
            const userCounts = await Moxi.shard.fetchClientValues('users.cache.size');
            totalGuilds = guildCounts.reduce((a, b) => a + b, 0);
            totalUsers = userCounts.reduce((a, b) => a + b, 0);
        } else {
            totalGuilds = Moxi.guilds.cache.size;
            totalUsers = Moxi.users.cache.size;
        }
        return [
            { name: moxi.translate('BOT_STATUS_VERSION', lang, { version: require('../../package.json').version }), type: ActivityType.Custom },
            { name: moxi.translate('BOT_STATUS_HELP', lang, { prefix: globalPrefix }), type: ActivityType.Custom },
            { name: moxi.translate('BOT_STATUS_USERS', lang, { users: totalUsers }), type: ActivityType.Custom },
            { name: moxi.translate('BOT_STATUS_SERVERS', lang, { servers: totalGuilds }), type: ActivityType.Custom },
            { name: moxi.translate('BOT_STATUS_MUSIC', lang, { prefix: globalPrefix }), type: ActivityType.Custom }
        ];
    }

    Moxi.poru.init(Moxi);

    try {
        mongoose.set("strictQuery", false);
        await mongoose.connect(process.env.MONGODB);
    } catch (error) {
        logger.error(`${EMOJIS.cross} Error crítio al conectar a MongoDB:`);
        logger.error(error.message);
    }

    const fixedLang = 'es-ES';
    let statusList = [];

    async function updateStatus() {
        statusList = await getStatusTexts(fixedLang);
        const randomStatus = statusList[Math.floor(Math.random() * statusList.length)];
        Moxi.user.setPresence({
            activities: [randomStatus],
            status: 'dnd'
        });
    }
    // Llama una vez al inicio
    updateStatus();
    // Y luego cada 5 segundos
    setInterval(updateStatus, 5000);

    logger.startup(`${EMOJIS.butter} Conectado como ${Moxi.user.tag}`);
    logger.divider();
    // logger.startup(`${EMOJIS.butter} Conectado como ${Moxi.user.tag}`);
    // Enviar componente V2 de arranque (estilo ping, sin botón)
    const { getStartupComponentV2 } = require("../../Components/V2/startupEmbedComponent");
    const { MessageFlags } = require("discord.js");
    const channelId = process.env.ERROR_CHANNEL_ID || '1459913736050704485';
    Moxi.channels.fetch(channelId).then(channel => {
        if (channel && channel.isTextBased()) {
            const component = getStartupComponentV2(Moxi);
            channel.send({ content: '', components: [component], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
        }
    });
});
