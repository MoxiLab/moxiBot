require('../Util/silentDotenv')();
(async () => {
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB;
    if (!uri) {
        console.error('MONGODB env missing');
        process.exit(1);
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbName = (process.env.MONGODB_DB || process.env.DB_NAME) || (new URL(uri).pathname.replace(/^\//, '')) || 'admin';
        const db = client.db(dbName);
        const res = await db.collection('languages').updateOne(
            { guildID: 'test-guild-langs' },
            { $set: { language: 'es-ES' }, $setOnInsert: { guildID: 'test-guild-langs' } },
            { upsert: true }
        );
        console.log('mongo update ok', res.result || res);
        const doc = await db.collection('languages').findOne({ guildID: 'test-guild-langs' });
        console.log(doc);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
        process.exit();
    }
})();
