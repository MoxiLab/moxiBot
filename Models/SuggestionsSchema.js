const mongoose = require('mongoose');

const suggestionsSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['config', 'suggestion'],
        default: 'suggestion',
        index: true,
    },
    guildID: { type: String, required: true, index: true },
    guildName: { type: String, default: null },

    // Config
    enabled: { type: Boolean, default: false },
    channelID: { type: String, default: null },
    staffChannelID: { type: String, default: null },

    // Suggestion
    suggestionId: { type: String, default: null },
    authorID: { type: String, default: null, index: true },
    authorTag: { type: String, default: null },
    content: { type: String, default: null },
    status: {
        type: String,
        enum: ['pending', 'approved', 'denied'],
        default: 'pending',
        index: true,
    },
    staffID: { type: String, default: null },
    staffTag: { type: String, default: null },
    reason: { type: String, default: null },

    messageID: { type: String, default: null },
    messageChannelID: { type: String, default: null },

    staffMessageID: { type: String, default: null },
    staffMessageChannelID: { type: String, default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, {
    collection: 'suggestions',
});

suggestionsSchema.index({ guildID: 1, type: 1 });
// Unique per guild for suggestion docs only (sparse avoids config docs)
suggestionsSchema.index({ guildID: 1, type: 1, suggestionId: 1 }, { unique: true, sparse: true });
suggestionsSchema.index({ guildID: 1, type: 1, messageID: 1 }, { sparse: true });

module.exports = mongoose.model('Suggestions', suggestionsSchema);
