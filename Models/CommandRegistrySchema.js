const mongoose = require('mongoose');

const CommandRegistrySchema = new mongoose.Schema(
    {
        botId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        type: { type: String, required: true, enum: ['prefix', 'slash'] },

        category: { type: String },
        description: { type: String },
        usage: { type: String },

        aliases: { type: [String], default: [] },
        cooldown: { type: Number },
        permissions: { type: [String], default: [] },

        // Slash-only (best-effort; se guarda tal cual lo expone Discord.js)
        slash: { type: mongoose.Schema.Types.Mixed },

        sourceFile: { type: String },
        lastSeenAt: { type: Date, default: () => new Date() },
        // Marca del último sync (para poder borrar los que ya no existen)
        syncStamp: { type: String, index: true },
    },
    { timestamps: true }
);

CommandRegistrySchema.index({ botId: 1, type: 1, name: 1 }, { unique: true });

// Forzar nombre de colección: más fácil de localizar en Mongo.
module.exports = mongoose.model('CommandRegistry', CommandRegistrySchema, 'commands');
