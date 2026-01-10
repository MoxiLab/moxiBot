const mongoose = require('mongoose');
require('../Util/silentDotenv')();

const Welcome = require('../Models/WelcomeSchema');

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
        const style = process.argv[3] || 'canvacard';
        const now = new Date();
        await Welcome.updateOne(
            { guildID: guildId, type: 'config' },
            { $setOnInsert: { guildID: guildId, createdAt: now }, $set: { style, updatedAt: now } },
            { upsert: true }
        );
        console.log('Set style', style, 'for', guildId);
    } catch (err) {
        console.error('Failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
