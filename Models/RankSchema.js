const mongoose = require('mongoose');

const rankSchema = new mongoose.Schema({
    guildID: {
        type: String,
        required: true
    },
    style: { type: String, default: 'sylphacard' },
    updatedAt: { type: Date, default: Date.now }
});

rankSchema.index({ guildID: 1 });

module.exports = mongoose.model('Rank', rankSchema);
