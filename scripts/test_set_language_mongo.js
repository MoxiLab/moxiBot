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
    const res = await db.collection('guilds').updateOne(
      { guildID: 'test-guild-123' },
      { $set: { Language: 'fr-FR' }, $setOnInsert: { guildID: 'test-guild-123' } },
      { upsert: true }
    );
    console.log('mongo update ok', res.result || res);
    const doc = await db.collection('guilds').findOne({ guildID: 'test-guild-123' });
    console.log(doc);
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
    process.exit();
  }
})();
