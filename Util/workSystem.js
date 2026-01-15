const { ensureMongoConnection } = require('./mongoConnect');
const { safeInt, formatDuration, msUntilNext } = require('./economyCore');
const moxi = require('../i18n');

const DEFAULT_WORK_COOLDOWN_MS = 60 * 60 * 1000; // 1h

const JOBS = Object.freeze([
    { id: 'barista', name: 'Barista', min: 30, max: 80, emoji: '☕' },
    { id: 'developer', name: 'Developer', min: 60, max: 140, emoji: '💻' },
    { id: 'designer', name: 'Designer', min: 50, max: 120, emoji: '🎨' },
    { id: 'chef', name: 'Chef', min: 40, max: 110, emoji: '🍳' },
    { id: 'delivery', name: 'Delivery', min: 35, max: 90, emoji: '🛵' },

    // Más jobs
    { id: 'cashier', name: 'Cashier', min: 30, max: 85, emoji: '🧾' },
    { id: 'waiter', name: 'Waiter', min: 35, max: 95, emoji: '🍽️' },
    { id: 'baker', name: 'Baker', min: 35, max: 105, emoji: '🥐' },
    { id: 'librarian', name: 'Librarian', min: 40, max: 110, emoji: '📚' },
    { id: 'teacher', name: 'Teacher', min: 45, max: 120, emoji: '🧑‍🏫' },
    { id: 'photographer', name: 'Photographer', min: 45, max: 125, emoji: '📷' },
    { id: 'musician', name: 'Musician', min: 45, max: 130, emoji: '🎸' },
    { id: 'artist', name: 'Artist', min: 45, max: 130, emoji: '🖌️' },
    { id: 'mechanic', name: 'Mechanic', min: 50, max: 140, emoji: '🧰' },
    { id: 'electrician', name: 'Electrician', min: 55, max: 150, emoji: '⚡' },
    { id: 'nurse', name: 'Nurse', min: 55, max: 155, emoji: '🩺' },
    { id: 'pilot', name: 'Pilot', min: 70, max: 190, emoji: '🛫' },
    { id: 'architect', name: 'Architect', min: 65, max: 185, emoji: '📐' },
    { id: 'engineer', name: 'Engineer', min: 70, max: 200, emoji: '🧪' },
    { id: 'scientist', name: 'Scientist', min: 75, max: 210, emoji: '🔬' },
]);

function normalizeText(input) {
    return String(input || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function getWorkCooldownMs() {
    const raw = Number(process.env.WORK_COOLDOWN_MS);
    if (Number.isFinite(raw) && raw > 0) return Math.trunc(raw);
    return DEFAULT_WORK_COOLDOWN_MS;
}

function listJobs() {
    return JOBS.slice();
}

function jobNameKey(jobId) {
    const id = String(jobId || '').trim().toUpperCase();
    if (!id) return '';
    return `WORK_JOB_${id}_NAME`;
}

function getJobDisplayName(jobOrId, lang = 'es-ES') {
    const id = (typeof jobOrId === 'string') ? jobOrId : jobOrId?.id;
    const job = (typeof jobOrId === 'object' && jobOrId) ? jobOrId : (JOBS.find(j => j.id === id) || null);
    if (!job) return String(jobOrId || '').trim();

    const key = jobNameKey(job.id);
    const translated = key ? moxi.translate(key, lang) : null;
    if (translated && typeof translated === 'string' && translated.trim() && translated !== key) {
        return translated.trim();
    }
    return String(job.name || job.id || '').trim();
}

function resolveJob(query, lang = null) {
    const q = normalizeText(query);
    if (!q) return null;

    // Por ID exacto
    const byId = JOBS.find(j => normalizeText(j.id) === q);
    if (byId) return byId;

    // Por nombre (inglés)
    const byName = JOBS.find(j => normalizeText(j.name) === q);
    if (byName) return byName;

    // Por nombre traducido (si hay lang)
    if (lang) {
        const byTranslated = JOBS.find(j => normalizeText(getJobDisplayName(j, lang)) === q);
        if (byTranslated) return byTranslated;
    }

    // Por prefijo/parcial
    const partial = JOBS.find(j => {
        if (normalizeText(j.id).includes(q)) return true;
        if (normalizeText(j.name).includes(q)) return true;
        if (lang && normalizeText(getJobDisplayName(j, lang)).includes(q)) return true;
        return false;
    });
    return partial || null;
}

async function getOrCreateEconomy(userId) {
    if (!process.env.MONGODB) {
        throw new Error('MongoDB no está configurado (MONGODB vacío).');
    }

    await ensureMongoConnection();
    const { UserEconomy } = require('../Models/EconomySchema');

    try {
        await UserEconomy.updateOne(
            { userId },
            { $setOnInsert: { userId, balance: 0, inventory: [], workTotalEarned: 0, workShifts: 0 } },
            { upsert: true }
        );
    } catch (e) {
        if (e?.code !== 11000) throw e;
    }

    return UserEconomy.findOne({ userId });
}

async function applyJob({ userId, jobId }) {
    if (!process.env.MONGODB) {
        return { ok: false, reason: 'no-db', message: 'MongoDB no está configurado (MONGODB vacío).' };
    }

    await ensureMongoConnection();
    const { UserEconomy } = require('../Models/EconomySchema');

    const now = new Date();

    // Asegurar doc
    try {
        await UserEconomy.updateOne(
            { userId },
            { $setOnInsert: { userId, balance: 0, inventory: [], workTotalEarned: 0, workShifts: 0 } },
            { upsert: true }
        );
    } catch (e) {
        if (e?.code !== 11000) throw e;
    }

    const updated = await UserEconomy.findOneAndUpdate(
        { userId },
        { $set: { workJobId: jobId, workStartedAt: now } },
        { new: true }
    );

    return { ok: true, economy: updated };
}

async function leaveJob({ userId }) {
    if (!process.env.MONGODB) {
        return { ok: false, reason: 'no-db', message: 'MongoDB no está configurado (MONGODB vacío).' };
    }

    await ensureMongoConnection();
    const { UserEconomy } = require('../Models/EconomySchema');

    const updated = await UserEconomy.findOneAndUpdate(
        { userId },
        { $unset: { workJobId: 1, workStartedAt: 1 } },
        { new: true }
    );

    return { ok: true, economy: updated };
}

function rollAmount(minAmount, maxAmount) {
    const min = safeInt(minAmount, 0);
    const max = safeInt(maxAmount, min);
    const amt = Math.floor(min + Math.random() * (max - min + 1));
    return Math.max(min, Math.min(max, amt));
}

async function doShift({ userId }) {
    if (!process.env.MONGODB) {
        return { ok: false, reason: 'no-db', message: 'MongoDB no está configurado (MONGODB vacío).' };
    }

    await ensureMongoConnection();
    const { UserEconomy } = require('../Models/EconomySchema');

    // Asegurar doc
    try {
        await UserEconomy.updateOne(
            { userId },
            { $setOnInsert: { userId, balance: 0, inventory: [], workTotalEarned: 0, workShifts: 0 } },
            { upsert: true }
        );
    } catch (e) {
        if (e?.code !== 11000) throw e;
    }

    const existing = await UserEconomy.findOne({ userId });
    const jobId = existing?.workJobId;
    if (!jobId) {
        return { ok: false, reason: 'no-job', message: 'No tienes trabajo. Usa `work apply <trabajo>`.' };
    }

    const job = JOBS.find(j => j.id === jobId) || null;
    if (!job) {
        return { ok: false, reason: 'bad-job', message: 'Tu trabajo actual ya no existe. Usa `work apply <trabajo>` de nuevo.' };
    }

    const cooldownMs = getWorkCooldownMs();
    const now = new Date();
    const cutoff = new Date(Date.now() - cooldownMs);
    const amount = rollAmount(job.min, job.max);

    const claimFilter = {
        userId,
        $or: [
            { lastWork: { $exists: false } },
            { lastWork: null },
            { lastWork: { $lte: cutoff } },
        ],
    };

    const updated = await UserEconomy.findOneAndUpdate(
        claimFilter,
        {
            $inc: { balance: amount, workTotalEarned: amount, workShifts: 1 },
            $set: { lastWork: now },
        },
        { new: true }
    );

    if (updated) {
        return {
            ok: true,
            job,
            amount,
            balance: safeInt(updated.balance, 0),
            nextInMs: 0,
        };
    }

    const remaining = msUntilNext(existing?.lastWork, cooldownMs);
    return {
        ok: false,
        reason: 'cooldown',
        job,
        nextInMs: remaining,
        nextInText: formatDuration(remaining),
        balance: safeInt(existing?.balance, 0),
    };
}

async function getWorkStats({ userId }) {
    const eco = await getOrCreateEconomy(userId);
    const job = eco?.workJobId ? (JOBS.find(j => j.id === eco.workJobId) || null) : null;
    const cooldownMs = getWorkCooldownMs();
    const remaining = msUntilNext(eco?.lastWork, cooldownMs);
    return {
        userId,
        balance: safeInt(eco?.balance, 0),
        job,
        startedAt: eco?.workStartedAt || null,
        lastWork: eco?.lastWork || null,
        nextInMs: remaining,
        nextInText: formatDuration(remaining),
        totalEarned: safeInt(eco?.workTotalEarned, 0),
        shifts: safeInt(eco?.workShifts, 0),
    };
}

async function getTopBalances({ limit = 10 } = {}) {
    if (!process.env.MONGODB) {
        return { ok: false, reason: 'no-db', message: 'MongoDB no está configurado (MONGODB vacío).' };
    }

    await ensureMongoConnection();
    const { UserEconomy } = require('../Models/EconomySchema');

    const n = Math.max(1, Math.min(25, safeInt(limit, 10)));
    const rows = await UserEconomy.find({}, { userId: 1, balance: 1 })
        .sort({ balance: -1 })
        .limit(n);

    return {
        ok: true,
        rows: rows.map(r => ({ userId: r.userId, balance: safeInt(r.balance, 0) })),
    };
}

module.exports = {
    listJobs,
    resolveJob,
    getJobDisplayName,
    getWorkCooldownMs,
    applyJob,
    leaveJob,
    doShift,
    getWorkStats,
    getTopBalances,
};
