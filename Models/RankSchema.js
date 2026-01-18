const mongoose = require('mongoose');

const RankSchema = new mongoose.Schema({
    guildID: {
        type: String,
        required: true
    },
    style: { type: String, default: 'sylphacard' },
    updatedAt: { type: Date, default: Date.now }
});

RankSchema.index({ guildID: 1 });

module.exports = mongoose.model('Rank', RankSchema);
