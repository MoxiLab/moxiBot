const mongoose = require('mongoose');

const PlaygroundJobsSchema = new mongoose.Schema(
    {
        botId: { type: String, index: true },
        guildId: { type: String, index: true },
        userId: { type: String, index: true },

        // Clave de deduplicación (para no encolar el mismo job muchas veces)
        // Se suele calcular como hash de: type + payload + scope (bot/guild/user)
        dedupeKey: { type: String, index: true },

        // Tipo de job (ej: "playground:test", "playground:eval", etc.)
        type: { type: String, required: true, index: true },

        payload: { type: mongoose.Schema.Types.Mixed, default: {} },

        status: {
            type: String,
            required: true,
            index: true,
            enum: ['queued', 'running', 'completed', 'failed', 'canceled'],
            default: 'queued',
        },

        priority: { type: Number, default: 0, index: true },
        runAt: { type: Date, default: () => new Date(), index: true },

        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 3 },

        lockedAt: { type: Date },
        lockedBy: { type: String },

        startedAt: { type: Date },
        completedAt: { type: Date },

        lastError: { type: String },
        result: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true }
);

PlaygroundJobsSchema.index({ status: 1, runAt: 1, priority: -1 });
PlaygroundJobsSchema.index({ botId: 1, status: 1, runAt: 1 });

// Evita duplicados simultáneos del mismo job (solo bloquea mientras está activo).
// Cuando un job pasa a completed/failed/canceled, ya no entra en el índice y se puede volver a encolar.
PlaygroundJobsSchema.index(
    { botId: 1, dedupeKey: 1 },
    {
        unique: true,
        partialFilterExpression: { status: { $in: ['queued', 'running'] } },
    }
);

module.exports = mongoose.model('PlaygroundJobs', PlaygroundJobsSchema, 'playground_jobs');
