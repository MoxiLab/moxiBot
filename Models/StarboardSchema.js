const mongoose = require('mongoose');

const starboardSchema = new mongoose.Schema({
    guildID: { type: String, required: true, index: true },
    channelID: { type: String, default: null },
    emoji: { type: String, default: '⭐' },
    threshold: { type: Number, default: 5, min: 1 },
    enabled: { type: Boolean, default: false },
    keepImages: { type: Boolean, default: true },
    mentionAuthor: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    collection: 'starboards'
});

starboardSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Starboard', starboardSchema);
