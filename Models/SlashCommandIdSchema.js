const mongoose = require('mongoose');
const { ensureMongoConnection } = require('../Util/mongoConnect');

function getSlashIdsCollectionName() {
    const env = process.env.SLASH_COMMAND_IDS_COLLECTION;
    if (typeof env === 'string' && env.trim()) return env.trim();
    return 'slash_command_ids';
}

// Persistir IDs en Mongo es opcional: activa SLASH_COMMAND_IDS_PERSIST=true
function shouldPersistSlashIds() {
    return process.env.SLASH_COMMAND_IDS_PERSIST === 'true';
}

const SlashCommandIdSchema = new mongoose.Schema(
    {
        applicationId: { type: String, required: true, index: true },
        // null/undefined => global command
        guildId: { type: String, default: null, index: true },
        name: { type: String, required: true, index: true },
        commandId: { type: String, required: true },
    },
    {
        timestamps: true,
        collection: getSlashIdsCollectionName(),
    }
);

SlashCommandIdSchema.index({ applicationId: 1, guildId: 1, name: 1 }, { unique: true });

// Evitar side-effects (conexión a Mongo) cuando el modelo se carga desde CLI.
// El bot conecta en `Eventos/Client/ready.js` y los scripts que necesiten DB llaman `ensureMongoConnection` explícitamente.
try {
    const path = require('path');
    const mainFile = require.main && require.main.filename ? String(require.main.filename) : '';
    const isScript = mainFile.includes(`${path.sep}scripts${path.sep}`);
    if (!isScript && shouldPersistSlashIds() && typeof process.env.MONGODB === 'string' && process.env.MONGODB.trim()) {
        ensureMongoConnection().catch(() => null);
    }
} catch {
    if (shouldPersistSlashIds() && typeof process.env.MONGODB === 'string' && process.env.MONGODB.trim()) {
        ensureMongoConnection().catch(() => null);
    }
}

module.exports = mongoose.model('SlashCommandId', SlashCommandIdSchema);
