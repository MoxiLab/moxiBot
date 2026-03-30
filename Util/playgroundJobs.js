const os = require('os');
const crypto = require('crypto');
const { ensureMongoConnection } = require('./mongoConnect');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');
const PlaygroundJobs = require('../Models/PlaygroundJobsSchema');
const { processPlaygroundJob } = require('./playgroundProcessor');

function normalizeString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function stableStringify(value) {
    if (value === null) return 'null';
    const t = typeof value;
    if (t === 'string') return JSON.stringify(value);
    if (t === 'number' || t === 'boolean') return String(value);
    if (t === 'bigint') return JSON.stringify(String(value));
    if (t === 'undefined') return 'null';
    if (t === 'function' || t === 'symbol') return 'null';

    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }

    if (value instanceof Date) {
        return JSON.stringify(value.toISOString());
    }

    if (t === 'object') {
        const keys = Object.keys(value).sort();
        const parts = [];
        for (const k of keys) {
            const v = value[k];
            if (v === undefined) continue;
            parts.push(JSON.stringify(k) + ':' + stableStringify(v));
        }
        return '{' + parts.join(',') + '}';
    }

    // fallback
    try {
        return JSON.stringify(value);
    } catch {
        return 'null';
    }
}

function computeDedupeKey(type, payload, scope) {
    const base = stableStringify({ type, payload: payload || {}, scope: scope || {} });
    const hash = crypto.createHash('sha1').update(base).digest('hex');
    return `${normalizeString(type)}:${hash}`;
}

async function enqueuePlaygroundJob(type, payload = {}, opts = {}) {
    await ensureMongoConnection();

    const botId = normalizeDiscordId(opts.botId) || normalizeString(opts.botId);
    const guildId = normalizeDiscordId(opts.guildId) || normalizeString(opts.guildId);
    const userId = normalizeDiscordId(opts.userId) || normalizeString(opts.userId);
    const safeType = normalizeDbText(type, { maxLen: 64, fallback: '' });
    if (!safeType) throw new Error('Invalid playground job type');

    const dedupeEnabled = opts.dedupe !== false;
    const dedupeKey = dedupeEnabled
            ? normalizeString(opts.dedupeKey) || computeDedupeKey(safeType, payload, { botId, guildId, userId })
        : '';

    const runAt = opts.runAt instanceof Date ? opts.runAt : (opts.runAt ? new Date(opts.runAt) : new Date());
    const priority = Number.isFinite(Number(opts.priority)) ? Number(opts.priority) : 0;
    const maxAttempts = Number.isFinite(Number(opts.maxAttempts)) ? Number(opts.maxAttempts) : 3;

    // Si ya existe un job activo (queued/running) con el mismo dedupeKey, reutilízalo.
    if (dedupeKey && botId) {
        const existing = await PlaygroundJobs.findOne({ botId, dedupeKey, status: { $in: ['queued', 'running'] } });
        if (existing) return existing;
    }

    try {
        return await PlaygroundJobs.create({
            botId: botId || undefined,
            guildId: guildId || undefined,
            userId: userId || undefined,
            dedupeKey: dedupeKey || undefined,
            type: safeType,
            payload: payload || {},
            status: 'queued',
            priority,
            runAt,
            attempts: 0,
            maxAttempts,
        });
    } catch (err) {
        // Carrera: si dos procesos intentan encolar el mismo job a la vez, el índice único parcial puede disparar.
        if (dedupeKey && botId && err && err.code === 11000) {
            const existing = await PlaygroundJobs.findOne({ botId, dedupeKey, status: { $in: ['queued', 'running'] } });
            if (existing) return existing;
        }
        throw err;
    }
}

async function enqueuePlaygroundJobInstant(type, payload = {}, opts = {}) {
    await ensureMongoConnection();

    const botId = normalizeDiscordId(opts.botId) || normalizeString(opts.botId);
    const guildId = normalizeDiscordId(opts.guildId) || normalizeString(opts.guildId);
    const userId = normalizeDiscordId(opts.userId) || normalizeString(opts.userId);
    const safeType = normalizeDbText(type, { maxLen: 64, fallback: '' });
    if (!safeType) throw new Error('Invalid playground job type');

    const runAt = opts.runAt instanceof Date ? opts.runAt : (opts.runAt ? new Date(opts.runAt) : new Date());
    const priority = Number.isFinite(Number(opts.priority)) ? Number(opts.priority) : 0;
    const maxAttempts = Number.isFinite(Number(opts.maxAttempts)) ? Number(opts.maxAttempts) : 3;

    const dedupeEnabled = opts.dedupe !== false;
    const dedupeKey = dedupeEnabled
            ? normalizeString(opts.dedupeKey) || computeDedupeKey(safeType, payload, { botId, guildId, userId })
        : '';

    const job = {
        botId: botId || undefined,
        guildId: guildId || undefined,
        userId: userId || undefined,
        dedupeKey: dedupeKey || undefined,
        type: safeType,
        payload: payload || {},
        status: 'completed',
        priority,
        runAt,
        attempts: 0,
        maxAttempts,
        completedAt: new Date(),
    };

    const result = await processPlaygroundJob(job);
    job.result = result;

    if (dedupeKey && botId) {
        return PlaygroundJobs.findOneAndUpdate(
            { botId, dedupeKey },
            {
                $set: {
                    ...job,
                    result,
                    updatedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );
    }

    return PlaygroundJobs.create({ ...job, result });
}

async function enqueuePlaygroundResult(type, payload = {}, result = {}, opts = {}) {
    await ensureMongoConnection();

    const botId = normalizeDiscordId(opts.botId) || normalizeString(opts.botId);
    const guildId = normalizeDiscordId(opts.guildId) || normalizeString(opts.guildId);
    const userId = normalizeDiscordId(opts.userId) || normalizeString(opts.userId);
    const safeType = normalizeDbText(type, { maxLen: 64, fallback: '' });
    if (!safeType) throw new Error('Invalid playground job type');

    const runAt = opts.runAt instanceof Date ? opts.runAt : (opts.runAt ? new Date(opts.runAt) : new Date());
    const priority = Number.isFinite(Number(opts.priority)) ? Number(opts.priority) : 0;
    const maxAttempts = Number.isFinite(Number(opts.maxAttempts)) ? Number(opts.maxAttempts) : 3;

    const dedupeEnabled = opts.dedupe !== false;
    const dedupeKey = dedupeEnabled
            ? normalizeString(opts.dedupeKey) || computeDedupeKey(safeType, payload, { botId, guildId, userId })
        : '';

    const job = {
        botId: botId || undefined,
        guildId: guildId || undefined,
        userId: userId || undefined,
        dedupeKey: dedupeKey || undefined,
        type: safeType,
        payload: payload || {},
        status: 'completed',
        priority,
        runAt,
        attempts: 0,
        maxAttempts,
        completedAt: new Date(),
    };

    if (dedupeKey && botId) {
        return PlaygroundJobs.findOneAndUpdate(
            { botId, dedupeKey },
            {
                $set: {
                    ...job,
                    result,
                    updatedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );
    }

    return PlaygroundJobs.create({ ...job, result });
}

async function takeNextPlaygroundJob(opts = {}) {
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

    if (opts.botId) filter.botId = normalizeString(opts.botId);

    return PlaygroundJobs.findOneAndUpdate(
        filter,
        {
            $set: {
                status: 'running',
                lockedAt: now,
                lockedBy: workerId,
                startedAt: now,
            },
        },
        {
            sort: { priority: -1, runAt: 1, createdAt: 1 },
            new: true,
        }
    );
}

async function completePlaygroundJob(jobId, result) {
    await ensureMongoConnection();
    return PlaygroundJobs.findByIdAndUpdate(
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

async function failPlaygroundJob(jobId, error, opts = {}) {
    await ensureMongoConnection();

    const retryDelayMs = Number.isFinite(Number(opts.retryDelayMs)) ? Number(opts.retryDelayMs) : 30_000;
    const now = new Date();

    const job = await PlaygroundJobs.findById(jobId);
    if (!job) return null;

    const nextAttempts = (job.attempts || 0) + 1;
    const shouldRetry = nextAttempts < (job.maxAttempts || 3);

    return PlaygroundJobs.findByIdAndUpdate(
        jobId,
        {
            $set: {
                status: shouldRetry ? 'queued' : 'failed',
                runAt: shouldRetry ? new Date(now.getTime() + retryDelayMs) : job.runAt,
                lockedAt: null,
                lockedBy: null,
                lastError: normalizeString(error?.message || error),
            },
            $inc: { attempts: 1 },
        },
        { new: true }
    );
}

module.exports = {
    enqueuePlaygroundJob,
    enqueuePlaygroundJobInstant,
    enqueuePlaygroundResult,
    takeNextPlaygroundJob,
    completePlaygroundJob,
    failPlaygroundJob,
};
