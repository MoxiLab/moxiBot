const mongoose = require('mongoose');

const languageSchema = new mongoose.Schema({
    guildID: {
        type: String,
        required: true
    },
    language: { type: String, default: 'es-ES' },
    updatedAt: { type: Date, default: Date.now }
});

languageSchema.index({ guildID: 1 });

module.exports = mongoose.model('Languages', languageSchema);
