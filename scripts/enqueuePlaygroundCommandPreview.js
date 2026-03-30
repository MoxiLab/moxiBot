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

    const name = (getArgValue('--name') || getArgValue('-n') || '').trim();
    const commandType = (getArgValue('--type') || 'slash').trim();
    const botId = String(getArgValue('--botId') || process.env.CLIENT_ID || process.env.BOT_ID || '').trim();
    const render = (getArgValue('--render') || '').trim();
    const includeUI = process.argv.includes('--ui');
    const asyncMode = process.argv.includes('--async');

    if (!botId) {
        console.error('Falta botId. Define CLIENT_ID en .env o usa --botId');
        process.exit(1);
    }
    if (!name) {
        console.error('Falta --name (nombre del comando)');
        process.exit(1);
    }

    const job = await (asyncMode ? enqueuePlaygroundJob : enqueuePlaygroundJobInstant)(
        'playground:commandPreview',
        { name, commandType, botId, render: render || undefined, includeUI: includeUI || undefined },
        { botId, runAt: new Date(), priority: 10 }
    );

    console.log('Enqueued playground commandPreview job:', String(job._id));

    await mongoose.disconnect().catch(() => null);
}

main().catch((e) => {
    console.error('enqueuePlaygroundCommandPreview failed:', e);
    process.exit(1);
});
