const mongoose = require('mongoose');

const GuildMessageSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    type: { type: String, required: true }, // 'rules', 'bug', etc.
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    lastLanguage: { type: String },
    meta: { type: Object }, // Para datos adicionales si se requiere
}, { timestamps: true });

GuildMessageSchema.index({ guildId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('GuildMessage', GuildMessageSchema);
