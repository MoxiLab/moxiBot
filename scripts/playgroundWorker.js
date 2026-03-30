require('../Util/silentDotenv')();

const logger = require('../Util/logger');
const { ensureMongoConnection, mongoose } = require('../Util/mongoConnect');
const { processPlaygroundJob } = require('../Util/playgroundProcessor');
const {
    takeNextPlaygroundJob,
    completePlaygroundJob,
    failPlaygroundJob,
} = require('../Util/playgroundJobs');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const once = process.argv.includes('--once');
    const intervalMs = Number(process.env.PLAYGROUND_WORKER_INTERVAL_MS || 750);

    await ensureMongoConnection();
    logger.info(`[playgroundWorker] connected intervalMs=${intervalMs} once=${once}`);

    do {
        let job = null;
        try {
            job = await takeNextPlaygroundJob({ lockMs: 120_000 });
            if (!job) {
                if (once) break;
                await sleep(intervalMs);
                continue;
            }

            const result = await processPlaygroundJob(job);
            await completePlaygroundJob(job._id, result);
        } catch (err) {
            if (job && job._id) {
                await failPlaygroundJob(job._id, err, { retryDelayMs: 5_000 });
            }
            if (once) throw err;
            await sleep(intervalMs);
        }

        if (once) break;
    } while (true);

    await mongoose.disconnect().catch(() => null);
    process.exit(0);
}

main().catch((e) => {
    console.error('playgroundWorker failed:', e);
    process.exit(1);
});
