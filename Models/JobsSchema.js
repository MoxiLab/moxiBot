const mongoose = require('mongoose');

const JobsSchema = new mongoose.Schema(
    {
        botId: { type: String, index: true },
        guildId: { type: String, index: true },
        userId: { type: String, index: true },

        // Tipo de job (ej: "sync", "cleanup", "reminder", etc.)
        type: { type: String, required: true, index: true },

        // Datos arbitrarios para el procesador del job
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

JobsSchema.index({ status: 1, runAt: 1, priority: -1 });
JobsSchema.index({ botId: 1, status: 1, runAt: 1 });

// Colección: jobs
module.exports = mongoose.model('Jobs', JobsSchema, 'jobs');
