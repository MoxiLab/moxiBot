const { Schema, model } = require('mongoose');

const AnniversaryAnnouncementSchema = new Schema(
    {
        guildID: {
            type: String,
            required: true,
            index: true,
        },
        pairKey: {
            type: String,
            required: true,
            index: true,
        },
        userA: {
            type: String,
            required: true,
        },
        userB: {
            type: String,
            required: true,
        },
        dateKey: {
            type: String,
            required: true,
            index: true,
        },
        years: {
            type: Number,
            default: 1,
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
        collection: 'anniversary_announcements',
    }
);

AnniversaryAnnouncementSchema.index({ guildID: 1, pairKey: 1, dateKey: 1 }, { unique: true });

module.exports = model('AnniversaryAnnouncement', AnniversaryAnnouncementSchema);
