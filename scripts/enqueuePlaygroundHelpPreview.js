require('../Util/silentDotenv')();

const { ensureMongoConnection, mongoose } = require('../Util/mongoConnect');
const { enqueuePlaygroundJob, enqueuePlaygroundJobInstant } = require('../Util/playgroundJobs');

function getArgValue(flag) {
    const argv = process.argv || [];
    const idx = argv.indexOf(flag);
    if (idx === -1) return null;
    const next = argv[idx + 1];
    if (!next || next.startsWith('-')) return null;
    return String(next);
}

async function main() {
    await ensureMongoConnection();

    const botId = String(getArgValue('--botId') || process.env.CLIENT_ID || process.env.BOT_ID || '').trim();
    if (!botId) {
        console.error('Falta botId. Define CLIENT_ID en .env o usa --botId');
        process.exit(1);
    }

    const payload = {
        botId,
        page: Number(getArgValue('--page') || 0),
        tipo: getArgValue('--tipo') || 'main',
        categoria: getArgValue('--categoria') || null,
        lang: getArgValue('--lang') || process.env.DEFAULT_LANG || 'es-ES',
        guildId: getArgValue('--guildId') || null,
        userId: getArgValue('--userId') || null,
    };

    const asyncMode = process.argv.includes('--async');

    const job = await (asyncMode ? enqueuePlaygroundJob : enqueuePlaygroundJobInstant)('playground:helpPreview', payload, {
        botId,
        runAt: new Date(),
        priority: 10,
    });

    console.log('Enqueued playground helpPreview job:', String(job._id));

    await mongoose.disconnect().catch(() => null);
}

main().catch((e) => {
    console.error('enqueuePlaygroundHelpPreview failed:', e);
    process.exit(1);
});
