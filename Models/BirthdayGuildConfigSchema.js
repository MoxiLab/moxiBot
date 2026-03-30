const { Schema, model } = require('mongoose');

const BirthdayGuildConfigSchema = new Schema(
    {
        guildID: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        channelID: {
            type: String,
            default: null,
        },
        updatedBy: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        collection: 'birthday_guild_config',
    }
);

module.exports = model('BirthdayGuildConfig', BirthdayGuildConfigSchema);