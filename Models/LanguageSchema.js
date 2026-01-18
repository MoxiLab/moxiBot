const mongoose = require('mongoose');

const LanguageSchema = new mongoose.Schema({
    guildID: {
        type: String,
        required: true
    },
    language: { type: String, default: 'es-ES' },
    updatedAt: { type: Date, default: Date.now }
});

LanguageSchema.index({ guildID: 1 });

module.exports = mongoose.model('Languages', LanguageSchema);
