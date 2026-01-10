const mongoose = require('mongoose');
require('../Util/silentDotenv')();

const { Welcome } = require('../Models');

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
        console.log('Querying Welcome (type=config) for guildID=', guildId);
        const doc = await Welcome.findOne({ guildID: String(guildId), type: 'config' }).lean();
        if (!doc) {
            console.log('No config welcome found. Checking member entries...');
            const members = await Welcome.find({ guildID: String(guildId), type: 'member' }).limit(10).lean();
            console.log('Member entries (up to 10):', members.length);
            console.dir(members, { depth: null, maxArrayLength: null });
        } else {
            console.log('Found welcome config:');
            console.dir(doc, { depth: null });
        }
    } catch (err) {
        console.error('Query failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
