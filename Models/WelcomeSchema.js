const mongoose = require('mongoose');

const WelcomeSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['config', 'member'],
        default: 'config',
        index: true
    },
    guildID: { type: String, required: true, index: true },
    guildName: { type: String, default: null },
    enabled: { type: Boolean, default: false },
    channelID: { type: String, default: null },
    message: { type: String, default: null },
    messages: { type: Map, of: String, default: {} },
    style: { type: String, default: 'sylphacard' },
    embed: { type: Boolean, default: true },
    memberID: { type: String, index: true },
    memberTag: String,
    memberUsername: String,
    isBot: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    collection: 'welcms'
});

// Index for efficient queries
WelcomeSchema.index({ guildID: 1, type: 1 });
WelcomeSchema.index({ guildID: 1, createdAt: -1 });

module.exports = mongoose.model('welcms', WelcomeSchema);

