require('./silentDotenv')();

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

    const envDbNameRaw = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || process.env.DB_NAME;
    const envDbName = (typeof envDbNameRaw === 'string' ? envDbNameRaw.trim() : '');
    const connectOptions = envDbName ? { ...options, dbName: envDbName } : options;

    connectionPromise = (async () => {
        mongoose.set('strictQuery', false);
        await mongoose.connect(uri, connectOptions);

        const dbName = mongoose.connection.name || 'default';
        logger.startup(`${EMOJIS.waffle} MongoDB conectado (${dbName})`);

        // Ayuda rápida: el error típico es conectar a "admin" cuando el usuario no tiene permisos ahí.
        if (!envDbName && dbName === 'admin') {
            logger.warn(
                `${EMOJIS.warn || '⚠️'} MongoDB está usando la BD "admin". ` +
                `Si tu usuario no tiene permisos, añade el nombre de tu BD al URI o define MONGODB_DB en el entorno.`
            );
        }

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
