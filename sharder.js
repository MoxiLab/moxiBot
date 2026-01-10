const { ShardingManager } = require('discord.js');
const logger = require('./Util/logger');
const { EMOJIS } = require('./Util/emojis');
const manager = new ShardingManager('./index.js', {
    token: process.env.TOKEN,
    totalShards: 'auto'
});

manager.on('shardCreate', shard => {
    logger.info(`${EMOJIS.iceCube} Launched shard ${shard.id}`);
});

manager.spawn(); 