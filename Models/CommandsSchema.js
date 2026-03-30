const mongoose = require('mongoose');

const SlashSubcommandSchema = new mongoose.Schema(
    {
        // Path completo para búsquedas fáciles: "/comando sub" o "/comando grupo sub"
        path: { type: String, required: true },
        group: { type: String },
        name: { type: String, required: true },
        description: { type: String },
    },
    { _id: false }
);

const CommandsSchema = new mongoose.Schema(
    {
        botId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        type: { type: String, required: true, enum: ['prefix', 'slash'] },

        // Tipo de entrada en el registry
        entryKind: { type: String, enum: ['command', 'subcommand'], default: 'command', index: true },
        // Para slash: si entryKind=subcommand, aquí queda el comando raíz
        rootName: { type: String, index: true },
        subcommandGroup: { type: String },
        subcommandName: { type: String },

        category: { type: String },
        description: { type: String },
        usage: { type: String },

        aliases: { type: [String], default: [] },
        cooldown: { type: Number },
        permissions: { type: [String], default: [] },

        // Estructura de comando/subcomandos (útil para listar y buscar)
        commandPath: { type: String },
        // Incluye commandPath + todos los subcomandos (si existen)
        commandPaths: { type: [String], default: [] },
        // Slash-only: subcomandos extraídos desde slash.options (best-effort)
        subcommands: { type: [SlashSubcommandSchema], default: [] },

        // Slash-only (best-effort; se guarda tal cual lo expone Discord.js)
        slash: { type: mongoose.Schema.Types.Mixed },

        sourceFile: { type: String },
        lastSeenAt: { type: Date, default: () => new Date() },
        // Marca del último sync (para poder borrar los que ya no existen)
        syncStamp: { type: String, index: true },
    },
    { timestamps: true }
);

CommandsSchema.index({ botId: 1, type: 1, name: 1 }, { unique: true });

// Forzar nombre de colección: más fácil de localizar en Mongo.
module.exports = mongoose.model('CommandRegistry', CommandsSchema, 'commands');
