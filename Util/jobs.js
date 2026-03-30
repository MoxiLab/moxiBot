const os = require('os');
const { ensureMongoConnection } = require('./mongoConnect');
const Jobs = require('../Models/JobsSchema');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

function normalizeString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

async function enqueueJob(type, payload = {}, opts = {}) {
    await ensureMongoConnection();

    const botId = normalizeDiscordId(opts.botId);
    const guildId = normalizeDiscordId(opts.guildId);
    const userId = normalizeDiscordId(opts.userId);

    const runAt = opts.runAt instanceof Date ? opts.runAt : (opts.runAt ? new Date(opts.runAt) : new Date());
    const priority = Number.isFinite(Number(opts.priority)) ? Number(opts.priority) : 0;
    const maxAttempts = Number.isFinite(Number(opts.maxAttempts)) ? Number(opts.maxAttempts) : 3;

    const doc = await Jobs.create({
        botId: botId || undefined,
        guildId: guildId || undefined,
        userId: userId || undefined,
        type: normalizeDbText(type, { maxLen: 80, fallback: '' }),
        payload: payload || {},
        status: 'queued',
        priority,
        runAt,
        attempts: 0,
        maxAttempts,
    });

    return doc;
}

async function takeNextJob(opts = {}) {
    await ensureMongoConnection();

    const now = new Date();
    const lockMs = Number.isFinite(Number(opts.lockMs)) ? Number(opts.lockMs) : 60_000;
    const lockCutoff = new Date(now.getTime() - lockMs);
    const workerId = normalizeString(opts.workerId) || `${os.hostname()}-${process.pid}`;

    const filter = {
        status: 'queued',
        runAt: { $lte: now },
        $or: [{ lockedAt: { $exists: false } }, { lockedAt: null }, { lockedAt: { $lt: lockCutoff } }],
    };

    const botId = normalizeDiscordId(opts.botId);
    if (botId) filter.botId = botId;

    const update = {
        $set: {
            status: 'running',
            lockedAt: now,
            lockedBy: workerId,
            startedAt: now,
        },
    };

    const job = await Jobs.findOneAndUpdate(filter, update, {
        sort: { priority: -1, runAt: 1, createdAt: 1 },
        new: true,
    });

    return job;
}

async function completeJob(jobId, result) {
    await ensureMongoConnection();
    return Jobs.findByIdAndUpdate(
        jobId,
        {
            $set: {
                status: 'completed',
                completedAt: new Date(),
                result: result,
                lockedAt: null,
                lockedBy: null,
                lastError: null,
            },
        },
        { new: true }
    );
}

async function failJob(jobId, error, opts = {}) {
    await ensureMongoConnection();

    const retryDelayMs = Number.isFinite(Number(opts.retryDelayMs)) ? Number(opts.retryDelayMs) : 30_000;
    const now = new Date();

    const job = await Jobs.findById(jobId);
    if (!job) return null;

    const nextAttempts = (job.attempts || 0) + 1;
    const shouldRetry = nextAttempts < (job.maxAttempts || 3);

    return Jobs.findByIdAndUpdate(
        jobId,
        {
            $set: {
                status: shouldRetry ? 'queued' : 'failed',
                runAt: shouldRetry ? new Date(now.getTime() + retryDelayMs) : job.runAt,
                lockedAt: null,
                lockedBy: null,
                lastError: normalizeString(error?.message || error),
            },
            $setOnInsert: {
                createdAt: now,
            },
            $inc: {
                attempts: 1,
            },
        },
        { new: true }
    );
}

module.exports = {
    enqueueJob,
    takeNextJob,
    completeJob,
    failJob,
};
