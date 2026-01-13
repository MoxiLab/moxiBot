const { ActivityType } = require("discord.js");
const logger = require("../../Util/logger");
const { EMOJIS } = require("../../Util/emojis");
const Config = require("../../Config");
const { ensureMongoConnection } = require('../../Util/mongoConnect');

module.exports = async (Moxi) => {
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

    try {
        Moxi.poru && Moxi.poru.init && Moxi.poru.init(Moxi);
    } catch (e) {
        logger.warn && logger.warn('[poru] init failed', e?.message || e);
    }

    if (typeof process.env.MONGODB === 'string' && process.env.MONGODB.trim()) {
        try {
            await ensureMongoConnection();
        } catch (error) {
            logger.error(`${EMOJIS.cross} Error crítico al conectar a MongoDB:`);
            logger.error(error?.message || error);
        }
    } else {
        logger.warn(`${EMOJIS.warning || EMOJIS.cross} MongoDB no configurado (MONGODB vacío). Se omiten funciones con base de datos.`);
    }

    // Warm up cache of slash command IDs (for mentions like </bug:ID>)
    // Importante: si quieres que funcionen "en cualquier servidor", usa comandos globales.
    // Por eso sincronizamos SIEMPRE primero los globales. (Los IDs globales son los mismos en todos los guilds.)
    try {
        const applicationId = process.env.CLIENT_ID;
        const envGuildId = process.env.GUILD_ID || null;
        if (applicationId && process.env.TOKEN) {
            const { syncSlashCommandIds } = require('../../Util/slashCommandMentions');

            const globalRes = await syncSlashCommandIds({ applicationId, guildId: null });
            logger.info && logger.info('[slashIds] synced', globalRes?.synced || 0, '(global)');

            // Si además estás trabajando en un guild concreto con comandos por-guild, sincronízalos también.
            if (envGuildId) {
                const guildRes = await syncSlashCommandIds({ applicationId, guildId: envGuildId });
                logger.info && logger.info('[slashIds] synced', guildRes?.synced || 0, '(guild)', envGuildId);
            }
        }
    } catch (e) {
        logger.warn && logger.warn('[slashIds] sync failed', e?.message || e);
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
};
