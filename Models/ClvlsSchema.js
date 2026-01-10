const { Schema, model } = require('mongoose');
const { EMOJIS } = require('../Util/emojis');

const ClvlsSchema = new Schema({
    guildID: { type: String, required: true, unique: true },
    minXpPerMessage: { type: Number, default: 5 },
    maxXpPerMessage: { type: Number, default: 25 },
    xpCooldown: { type: Number, default: 60 },
    prestigeEnabled: { type: Boolean, default: false },
    levelRequiredForPrestige: { type: Number, default: 50 },
    dailyBonusEnabled: { type: Boolean, default: false },
    dailyBonusXp: { type: Number, default: 100 },
    reactionBonusEnabled: { type: Boolean, default: false },
    xpPerReaction: { type: Number, default: 5 },
    levelUpNotifications: {
        enabled: { type: Boolean, default: false },
        channel: { type: String, default: null },
        message: { type: String, default: `${EMOJIS.party} ¡{user} ha subido al nivel {level}!` }
    },
    blockedChannels: { type: [String], default: [] },
    allowedChannels: { type: [String], default: [] },
    multipliers: {
        byRole: [{ roleID: String, multiplier: Number }],
        byChannel: [{ channelID: String, multiplier: Number }]
    },
    minCharactersForXp: { type: Number, default: 10 }
}, {
    timestamps: true,
    collection: 'clvls'
});

module.exports = model('Clvls', ClvlsSchema);
