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
        const collection = db.collection('guilds');

        console.log('[clear-guilds-language] Unsetting Language and language fields from guilds...');
        const res = await collection.updateMany({ $or: [{ Language: { $exists: true } }, { language: { $exists: true } }] }, { $unset: { Language: '', language: '' } });
        console.log('[clear-guilds-language] matchedCount:', res.matchedCount, 'modifiedCount:', res.modifiedCount);

        const remaining = await collection.countDocuments({ $or: [{ Language: { $exists: true } }, { language: { $exists: true } }] });
        console.log('[clear-guilds-language] remaining language fields:', remaining);
    } catch (e) {
        console.error('[clear-guilds-language] error', e);
    } finally {
        await client.close();
        process.exit();
    }
})();
