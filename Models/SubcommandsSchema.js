const mongoose = require('mongoose');

const SubcommandsSchema = new mongoose.Schema(
    {
        botId: { type: String, required: true, index: true },
        // Por ahora solo aplicable a slash, pero lo dejamos extensible
        type: { type: String, required: true, enum: ['slash'] },

        rootName: { type: String, required: true, index: true },
        subcommandGroup: { type: String, default: '' },
        subcommandName: { type: String, required: true },

        // Path completo: "/comando sub" o "/comando grupo sub"
        commandPath: { type: String, required: true, index: true },

        category: { type: String },
        description: { type: String },

        sourceFile: { type: String },
        lastSeenAt: { type: Date, default: () => new Date() },
        syncStamp: { type: String, index: true },
    },
    { timestamps: true }
);

SubcommandsSchema.index(
    { botId: 1, type: 1, rootName: 1, subcommandGroup: 1, subcommandName: 1 },
    { unique: true }
);

module.exports = mongoose.model('Subcommands', SubcommandsSchema, 'subcommands');
