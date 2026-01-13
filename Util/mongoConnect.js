const mongoose = require('mongoose');
const logger = require('./logger');
const { EMOJIS } = require('./emojis');

let connectionPromise = null;

async function ensureMongoConnection(options = {}) {
    if (mongoose.connection.readyState === 1) return mongoose.connection;
    if (connectionPromise) return connectionPromise;

    const uri = process.env.MONGODB;
    if (typeof uri !== 'string' || !uri.trim()) {
        const err = new Error('MONGODB env var no está definida (URI vacío).');
        logger.error(`${EMOJIS.cross} ${err.message}`);
        throw err;
    }

    connectionPromise = (async () => {
        mongoose.set('strictQuery', false);
        logger.startup(`${EMOJIS.hourglass} Conectando a MongoDB...`);
        await mongoose.connect(uri, options);
        logger.startup(`${EMOJIS.waffle} MongoDB conectado (${mongoose.connection.name || 'default'})`);
        return mongoose.connection;
    })();

    try {
        return await connectionPromise;
    } catch (error) {
        connectionPromise = null;
        logger.error(`${EMOJIS.cross} Error al conectar a MongoDB:`);
        logger.error(error.message);
        throw error;
    }
}

module.exports = {
    ensureMongoConnection,
    mongoose,
};
