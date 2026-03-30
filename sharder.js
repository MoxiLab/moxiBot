const { ShardingManager } = require('discord.js');
const logger = require('./Util/logger');
const { EMOJIS } = require('./Util/emojis');

// Cargar .env lo antes posible para TOKEN y resto de vars.
require('./Util/silentDotenv')();

const manager = new ShardingManager('./index.js', {
    token: process.env.TOKEN,
    totalShards: 'auto'
});

manager.on('shardCreate', shard => {
    logger.info(`${EMOJIS.iceCube} Launched shard ${shard.id}`);
});

manager.spawn(); 