const mongoose = require('mongoose');

const CooldownReminderSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    type: { type: String, required: true }, // work | salary | crime | fish | mine | ...
    fireAt: { type: Number, required: true }, // timestamp en ms
    fired: { type: Boolean, default: false },
    canceled: { type: Boolean, default: false },
}, { timestamps: true });

// 1 reminder activo por tipo y usuario (por guild)
CooldownReminderSchema.index({ guildId: 1, userId: 1, type: 1 }, { unique: true });
CooldownReminderSchema.index({ fireAt: 1 });

module.exports = mongoose.model('CooldownReminder', CooldownReminderSchema);
