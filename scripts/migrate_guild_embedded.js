const mongoose = require('mongoose');
require('../Util/silentDotenv')();

const Welcome = require('../Models/WelcomeSchema');
const Rank = require('../Models/RankSchema');
const Languages = require('../Models/LanguageSchema');

async function main() {
    const uri = process.env.MONGODB;
    const dbName = process.env.MONGODB_DB || undefined;
    if (!uri) {
        console.error('MONGODB environment variable not set');
        process.exit(1);
    }

    await mongoose.connect(uri, dbName ? { dbName } : {});
    const conn = mongoose.connection;
    const guildsCol = conn.collection('guilds');
    const byesCol = conn.collection('byes');

    const cursor = guildsCol.find({});
    let total = 0;
    const stats = { welcome: 0, byes: 0, rank: 0, language: 0 };

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        total++;
        const guildID = String(doc.guildID || doc.guildId || doc._id || '');
        if (!guildID) continue;

        // Welcome (legacy embedded)
        const welcome = doc.Welcome || doc.welcome || null;
        if (welcome && (welcome.enabled || welcome.channelID || welcome.message)) {
            try {
                await Welcome.updateOne(
                    { guildID, type: 'config' },
                    {
                        $setOnInsert: { guildID, createdAt: welcome.updatedAt || new Date() },
                        $set: {
                            guildName: doc.guildName || null,
                            enabled: !!welcome.enabled,
                            channelID: welcome.channelID || null,
                            message: welcome.message || null,
                            embed: (typeof welcome.embed === 'boolean') ? welcome.embed : true,
                            updatedAt: welcome.updatedAt || new Date(),
                        }
                    },
                    { upsert: true }
                );
                stats.welcome++;
            } catch (err) {
                console.error('Welcome upsert failed for', guildID, err.message || err);
            }
        }

        // Byes (legacy embedded) - write directly to 'byes' collection
        const byes = doc.Byes || doc.byes || null;
        if (byes && (byes.enabled || byes.channelID || byes.message)) {
            try {
                await byesCol.updateOne(
                    { guildID },
                    {
                        $setOnInsert: { guildID, createdAt: byes.updatedAt || new Date() },
                        $set: {
                            guildName: doc.guildName || null,
                            enabled: !!byes.enabled,
                            channelID: byes.channelID || null,
                            message: byes.message || null,
                            style: byes.style || 'sylphacard',
                            updatedAt: byes.updatedAt || new Date(),
                        }
                    },
                    { upsert: true }
                );
                stats.byes++;
            } catch (err) {
                console.error('Byes upsert failed for', guildID, err.message || err);
            }
        }

        // Rank
        const rank = doc.Rank || doc.rank || null;
        if (rank && (rank.style || rank.updatedAt)) {
            try {
                await Rank.updateOne(
                    { guildID },
                    {
                        $setOnInsert: { guildID, createdAt: rank.updatedAt || new Date() },
                        $set: {
                            style: rank.style || 'sylphacard',
                            updatedAt: rank.updatedAt || new Date(),
                        }
                    },
                    { upsert: true }
                );
                stats.rank++;
            } catch (err) {
                console.error('Rank upsert failed for', guildID, err.message || err);
            }
        }

        // Language
        const language = doc.Language || doc.language || null;
        if (language) {
            try {
                await Languages.updateOne(
                    { guildID },
                    {
                        $setOnInsert: { guildID, createdAt: new Date() },
                        $set: { language: String(language), updatedAt: new Date() }
                    },
                    { upsert: true }
                );
                stats.language++;
            } catch (err) {
                console.error('Language upsert failed for', guildID, err.message || err);
            }
        }
    }

    console.log('Migration completed. Scanned:', total, 'Welcome:', stats.welcome, 'Byes:', stats.byes, 'Rank:', stats.rank, 'Language:', stats.language);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
