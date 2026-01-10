const { Schema, model } = require('mongoose');

const GuildSchema = new Schema({
    guildID: {
        type: String,
        required: true,
        unique: true
    },
    ownerID: {
        type: String,
        default: null
    },
    // Idioma preferido del servidor
    Language: {
        type: String,
        default: 'es-ES'
    },
    guildName: {
        type: String,
        default: null
    }
}, {
    timestamps: true,
    collection: 'guilds'
});


module.exports = model('Guild', GuildSchema);