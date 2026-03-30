/**
 * migrateGlobalLevel.js
 * Pre-popula globalLevel/globalXp/globalTotalXp en EconomySchema
 * usando el nivel más alto de cada usuario a través de todos los servidores.
 *
 * Uso: node scripts/migrateGlobalLevel.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    if (!process.env.MONGODB) {
        console.error('❌  MONGODB no definido en .env');
        process.exit(1);
    }

    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB);
    console.log('✅ Conectado.');

    const User = mongoose.connection.collection('users');
    const Economy = mongoose.connection.collection('economies');

    // Agrupar por userID y tomar el nivel más alto de todos los servidores
    const pipeline = [
        {
            $group: {
                _id: '$userID',
                bestLevel: { $max: { $ifNull: ['$level', 1] } },
                bestTotalXp: { $max: { $ifNull: ['$totalXp', 0] } },
            },
        },
    ];

    const cursor = User.aggregate(pipeline);
    let updated = 0;
    let skipped = 0;

    for await (const doc of cursor) {
        const userId = String(doc._id || '').trim();
        if (!userId) { skipped++; continue; }

        const level = Math.max(1, Number(doc.bestLevel) || 1);
        const totalXp = Math.max(0, Number(doc.bestTotalXp) || 0);

        const result = await Economy.updateOne(
            { userId },
            {
                $set: {
                    globalLevel: level,
                    globalXp: 0,
                    globalTotalXp: totalXp,
                },
            }
        );

        if (result.matchedCount > 0) {
            updated++;
        } else {
            skipped++;
        }
    }

    console.log(`✅ Migración completada: ${updated} usuarios actualizados, ${skipped} sin documento Economy.`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('❌ Error durante la migración:', err);
    mongoose.disconnect().catch(() => null);
    process.exit(1);
});
