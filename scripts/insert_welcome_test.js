const mongoose = require('mongoose');
require('../Util/silentDotenv')();

const Welcome = require('../Models/WelcomeSchema');
const Guild = require('../Models/GuildSchema');

async function main() {
    const uri = process.env.MONGODB;
    const dbName = process.env.MONGODB_DB || undefined;
    if (!uri) {
        console.error('MONGODB env var not set');
        process.exit(1);
    }

    await mongoose.connect(uri, dbName ? { dbName } : {});
    try {
        const guildId = process.argv[2] || '1454227420507799715';
        const now = new Date();

        // Upsert into dedicated welcome collection
        await Welcome.updateOne(
            { guildID: guildId, type: 'config' },
            {
                $setOnInsert: { guildID: guildId, createdAt: now },
                $set: {
                    enabled: true,
                    channelID: null,
                    message: '¡Bienvenid@ {user} a {server}!',
                    embed: true,
                    updatedAt: now
                }
            },
            { upsert: true }
        );

        // Also upsert legacy embedded Welcome into guilds collection
        await Guild.findOneAndUpdate(
            { guildID: guildId },
            { $set: { 'Welcome.enabled': true, 'Welcome.channelID': null, 'Welcome.message': '¡Bienvenid@ {user} a {server}!', 'Welcome.updatedAt': now }, $setOnInsert: { guildID: guildId } },
            { upsert: true, new: true }
        );

        console.log('Welcome test entry inserted for', guildId);
    } catch (err) {
        console.error('Insert failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
