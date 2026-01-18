const mongoose = require('mongoose');
const { ensureMongoConnection } = require('../Util/mongoConnect');

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
        collection: 'slash_command_ids',
    }
);

SlashCommandIdSchema.index({ applicationId: 1, guildId: 1, name: 1 }, { unique: true });

// Evitar side-effects (conexión a Mongo) cuando el modelo se carga desde scripts/CLI.
// El bot conecta en `Eventos/Client/ready.js` y los scripts que necesiten DB llaman `ensureMongoConnection` explícitamente.
try {
    const path = require('path');
    const mainFile = require.main && require.main.filename ? String(require.main.filename) : '';
    const isScript = mainFile.includes(`${path.sep}scripts${path.sep}`);
    if (!isScript && typeof process.env.MONGODB === 'string' && process.env.MONGODB.trim()) {
        ensureMongoConnection().catch(() => null);
    }
} catch {
    if (typeof process.env.MONGODB === 'string' && process.env.MONGODB.trim()) {
        ensureMongoConnection().catch(() => null);
    }
}

module.exports = mongoose.model('SlashCommandId', SlashCommandIdSchema);
