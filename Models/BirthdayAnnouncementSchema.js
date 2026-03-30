const { Schema, model } = require('mongoose');

const BirthdayAnnouncementSchema = new Schema(
    {
        guildID: {
            type: String,
            required: true,
            index: true,
        },
        userID: {
            type: String,
            required: true,
            index: true,
        },
        dateKey: {
            type: String,
            required: true,
            index: true,
        },
        channelID: {
            type: String,
            default: null,
        },
        announcedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        collection: 'birthday_announcements',
    }
);

BirthdayAnnouncementSchema.index({ guildID: 1, userID: 1, dateKey: 1 }, { unique: true });

module.exports = model('BirthdayAnnouncement', BirthdayAnnouncementSchema);