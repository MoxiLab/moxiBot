const mongoose = require('mongoose');
const { ensureMongoConnection } = require('../Util/mongoConnect');

const bugSchema = new mongoose.Schema({
    guildID: { type: String, required: true, index: true },
    type: { type: String, enum: ['report', 'settings'], default: 'report', index: true },
    userId: { type: String, default: null },
    username: { type: String, default: null },
    channelId: { type: String, default: null },
    description: { type: String, default: null },
    attachments: { type: [String], default: [] },
    status: { type: String, enum: ['info', 'new', 'pending', 'complete'], default: 'new' },
    forumChannelId: { type: String, default: null },
    forumThreadId: { type: String, default: null },
    logChannelId: { type: String, default: null },
    tagIds: {
        info: { type: String, default: null },
        status: {
            new: { type: String, default: null },
            pending: { type: String, default: null },
            complete: { type: String, default: null },
        }
    }
}, {
    timestamps: true,
    collection: 'bugs'
});

ensureMongoConnection().catch(() => null);

module.exports = mongoose.model('Bug', bugSchema);
