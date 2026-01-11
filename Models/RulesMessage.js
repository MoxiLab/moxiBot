const mongoose = require('mongoose');

const RulesMessageSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    lastLanguage: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('RulesMessage', RulesMessageSchema);
