const mongoose = require('mongoose');

const TimerSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    endTime: { type: Number, required: true }, // timestamp en ms
    minutos: { type: Number, required: true },
}, { timestamps: true });

TimerSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

module.exports = mongoose.model('Timer', TimerSchema);
