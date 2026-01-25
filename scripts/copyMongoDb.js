/*
 * Copia una base de datos (o una colección) en MongoDB.
 *
 * Uso (PowerShell):
 *   $env:CONFIRM='YES';
 *   $env:SOURCE_DB='admin';
 *   $env:DEST_DB='moxi';
 *   $env:ALLOW_ADMIN_DB='YES'; # solo si usas admin/local/config
 *   node scripts/copyMongoDb.js
 *
 * Opcionales:
 *   $env:SOURCE_COLLECTION='Users';
 *   $env:DEST_COLLECTION='Users';
 *   $env:OVERWRITE='YES';    # permite escribir aunque DEST_DB tenga colecciones
 *   $env:DROP_DEST='YES';    # borra colecciones destino antes de copiar (por defecto YES si OVERWRITE)
 *   $env:COPY_INDEXES='YES'; # por defecto YES
 *   $env:BATCH_SIZE='1000';
 */

require('../Util/silentDotenv')();

const mongoose = require('mongoose');

function envBool(name, defaultValue = false) {
    const raw = String(process.env[name] ?? '').trim().toLowerCase();
    if (!raw) return defaultValue;
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
}

function requireConfirm() {
    return String(process.env.CONFIRM ?? '').trim().toUpperCase() === 'YES';
}

function isProtectedDbName(name) {
    const n = String(name ?? '').trim().toLowerCase();
    return n === 'admin' || n === 'local' || n === 'config';
}

async function dropCollectionIfExists(db, name) {
    try {
        await db.collection(name).drop();
        return true;
    } catch (err) {
        // NamespaceNotFound
        if (err && (err.code === 26 || err.codeName === 'NamespaceNotFound')) return false;
        throw err;
    }
}

async function copyCollection({ srcDb, dstDb, srcName, dstName, batchSize, copyIndexes, dropDest }) {
    if (dropDest) {
        await dropCollectionIfExists(dstDb, dstName);
    }

    const srcCol = srcDb.collection(srcName);
    const dstCol = dstDb.collection(dstName);

    let indexes = [];
    if (copyIndexes) {
        try {
            indexes = await srcCol.indexes();
        } catch {
            indexes = [];
        }
    }

    let inserted = 0;
    const cursor = srcCol.find({}, { batchSize });

    let batch = [];
    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if(doc) {
            batch.push(doc);
            if (batch.length >= batchSize) {
                try {
                    const res = await dstCol.insertMany(batch, { ordered: false });
                    inserted += res?.insertedCount ?? 0;
                } catch (err) {
                    inserted += err?.result?.insertedCount ?? 0;
                    // si hay errores por duplicados u otros, los dejamos visibles
                    if (err?.code !== 11000) throw err;
                }
                batch = [];
            }
        }
    }

    if (batch.length) {
        try {
            const res = await dstCol.insertMany(batch, { ordered: false });
            inserted += res?.insertedCount ?? 0;
        } catch (err) {
            inserted += err?.result?.insertedCount ?? 0;
            if (err?.code !== 11000) throw err;
        }
    }

    if (copyIndexes && Array.isArray(indexes) && indexes.length) {
        for (const idx of indexes) {
            if (idx && idx.name != '_id_') {
                const { key, name, v, ns, ...options } = idx;
                // Evitar opciones internas que pueden romper
                delete options.key;
                delete options.name;
                delete options.v;
                delete options.ns;
                await dstCol.createIndex(key, { name, ...options });
            }
        }
    }

    return { inserted, indexes: Array.isArray(indexes) ? indexes.length : 0 };
}

async function main() {
    const uri = String(process.env.MONGODB ?? '').trim();
    if (!uri) {
        throw new Error('Falta MONGODB (URI).');
    }

    const sourceDb = String(process.env.SOURCE_DB ?? process.env.MONGODB_DB ?? process.env.DB_NAME ?? '').trim();
    const destDb = String(process.env.DEST_DB ?? '').trim();
    const sourceCollection = String(process.env.SOURCE_COLLECTION ?? '').trim();
    const destCollection = String(process.env.DEST_COLLECTION ?? '').trim();

    if (!sourceDb) {
        throw new Error('Falta SOURCE_DB (o MONGODB_DB/DB_NAME).');
    }
    if (!destDb) {
        throw new Error('Falta DEST_DB.');
    }

    const confirm = requireConfirm();
    if (!confirm) {
        console.error('[ABORT] Para evitar accidentes, define CONFIRM=YES antes de copiar.');
        console.error('Ejemplo (PowerShell):');
        console.error("  $env:CONFIRM='YES'; $env:SOURCE_DB='admin'; $env:DEST_DB='moxi'; node scripts/copyMongoDb.js");
        process.exit(1);
    }

    const allowAdminDb = envBool('ALLOW_ADMIN_DB', false);
    if ((isProtectedDbName(sourceDb) || isProtectedDbName(destDb)) && !allowAdminDb) {
        throw new Error('SOURCE_DB o DEST_DB es admin/local/config. Si de verdad quieres hacerlo, define ALLOW_ADMIN_DB=YES.');
    }

    const overwrite = envBool('OVERWRITE', false);
    const copyIndexes = envBool('COPY_INDEXES', true);
    const batchSizeRaw = Number(process.env.BATCH_SIZE ?? 1000);
    const batchSize = Number.isFinite(batchSizeRaw) ? Math.max(10, Math.min(5000, Math.floor(batchSizeRaw))) : 1000;

    // Por defecto, si OVERWRITE está activo, dropeamos colecciones destino.
    const dropDest = envBool('DROP_DEST', overwrite);

    await mongoose.connect(uri, { dbName: sourceDb });
    const client = mongoose.connection.getClient();

    const srcDb = client.db(sourceDb);
    const dstDb = client.db(destDb);

    const destCollections = await dstDb.listCollections({}, { nameOnly: true }).toArray();
    const destHasCollections = Array.isArray(destCollections) && destCollections.length > 0;

    if (destHasCollections && !overwrite) {
        throw new Error(
            `DEST_DB (${destDb}) ya tiene colecciones (${destCollections.length}). ` +
            'Para sobrescribir, define OVERWRITE=YES (y opcionalmente DROP_DEST=YES).'
        );
    }

    let collectionsToCopy = [];
    if (sourceCollection) {
        collectionsToCopy = [sourceCollection];
    } else {
        const srcCollections = await srcDb.listCollections({}, { nameOnly: true }).toArray();
        collectionsToCopy = (srcCollections || [])
            .map((c) => c?.name)
            .filter(Boolean)
            .filter((n) => !String(n).startsWith('system.'));
    }

    if (!collectionsToCopy.length) {
        throw new Error(`SOURCE_DB (${sourceDb}) no tiene colecciones para copiar.`);
    }

    if (destCollection && !sourceCollection) {
        throw new Error('DEST_COLLECTION solo tiene sentido si también defines SOURCE_COLLECTION.');
    }

    console.log(`CopyMongoDb: ${sourceDb}${sourceCollection ? '.' + sourceCollection : ''} -> ${destDb}${destCollection ? '.' + destCollection : ''}`);
    console.log(`Options: overwrite=${overwrite} dropDest=${dropDest} copyIndexes=${copyIndexes} batchSize=${batchSize}`);

    const startedAt = Date.now();
    const results = [];

    for (const srcName of collectionsToCopy) {
        const dstName = sourceCollection ? (destCollection || srcName) : srcName;
        const r = await copyCollection({
            srcDb,
            dstDb,
            srcName,
            dstName,
            batchSize,
            copyIndexes,
            dropDest,
        });
        results.push({ srcName, dstName, ...r });
        console.log(`- ${srcName} -> ${dstName}: inserted=${r.inserted}`);
    }

    const ms = Date.now() - startedAt;
    const totalInserted = results.reduce((a, r) => a + (r.inserted || 0), 0);
    console.log(`Done: collections=${results.length} inserted=${totalInserted} timeMs=${ms}`);

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err?.stack || err?.message || String(err));
    try { await mongoose.disconnect(); } catch { }
    process.exit(1);
});
