const { ensureMongoConnection } = require('./mongoConnect');
const { safeInt, formatDuration, msUntilNext } = require('./economyCore');
const moxi = require('../i18n');

const DEFAULT_WORK_COOLDOWN_MS = 15 * 60 * 1000; // 15m

const JOBS = Object.freeze([
    {
        id: 'barista',
        name: 'Barista',
        min: 30,
        max: 80,
        salary: 60,
        shiftsRequired: 4,
        deathRisk: false,
        requirements: ['Amabilidad', 'Higiene', 'Puntualidad'],
        featured: true,
        emoji: '☕',
        tagline: 'Únete para servir experiencias memorables como barista.',
    },
    {
        id: 'developer',
        name: 'Developer',
        min: 60,
        max: 140,
        salary: 100,
        shiftsRequired: 10,
        deathRisk: false,
        requirements: ['Conocimientos básicos', 'Laptop / PC'],
        emoji: '💻',
        imageUrl: 'https://dummyimage.com/160x160/0f172a/ffffff.png&text=%F0%9F%92%BB',
    },
    {
        id: 'designer',
        name: 'Designer',
        min: 50,
        max: 120,
        salary: 90,
        shiftsRequired: 8,
        deathRisk: false,
        requirements: ['Creatividad', 'Portafolio'],
        emoji: '🎨',
        imageUrl: 'https://dummyimage.com/160x160/1f2937/ffffff.png&text=%F0%9F%8E%A8',
    },
    {
        id: 'chef',
        name: 'Chef',
        min: 40,
        max: 110,
        salary: 85,
        shiftsRequired: 7,
        deathRisk: false,
        requirements: ['Higiene', 'Resistencia', 'Trabajo bajo presión'],
        emoji: '🍳',
        imageUrl: 'https://dummyimage.com/160x160/111827/ffffff.png&text=%F0%9F%8D%B3',
    },
    {
        id: 'delivery',
        name: 'Delivery',
        min: 35,
        max: 90,
        salary: 70,
        shiftsRequired: 5,
        deathRisk: true,
        requirements: ['Licencia', 'Casco', 'Conocer rutas'],
        emoji: '🛵',
        imageUrl: 'https://dummyimage.com/160x160/111827/ffffff.png&text=%F0%9F%9B%B5',
    },

    // Más jobs
    { id: 'cashier', name: 'Cashier', min: 30, max: 85, salary: 70, shiftsRequired: 4, deathRisk: false, requirements: ['Atención al cliente', 'Manejo de caja'], emoji: '🧾' },
    { id: 'waiter', name: 'Waiter', min: 35, max: 95, salary: 75, shiftsRequired: 6, deathRisk: false, requirements: ['Memoria', 'Rapidez'], emoji: '🍽️' },
    { id: 'baker', name: 'Baker', min: 35, max: 105, salary: 80, shiftsRequired: 7, deathRisk: false, requirements: ['Madrugar', 'Higiene'], emoji: '🥐' },
    { id: 'librarian', name: 'Librarian', min: 40, max: 110, salary: 85, shiftsRequired: 8, deathRisk: false, requirements: ['Orden', 'Silencio absoluto'], emoji: '📚' },
    { id: 'teacher', name: 'Teacher', min: 45, max: 120, salary: 90, shiftsRequired: 9, deathRisk: false, requirements: ['Paciencia', 'Comunicación'], emoji: '🧑‍🏫' },
    { id: 'photographer', name: 'Photographer', min: 45, max: 125, salary: 95, shiftsRequired: 7, deathRisk: false, requirements: ['Cámara', 'Ojo artístico'], emoji: '📷' },
    { id: 'musician', name: 'Musician', min: 45, max: 130, salary: 100, shiftsRequired: 6, deathRisk: false, requirements: ['Instrumento', 'Practicar'], emoji: '🎸' },
    { id: 'artist', name: 'Artist', min: 45, max: 130, salary: 100, shiftsRequired: 6, deathRisk: false, requirements: ['Creatividad', 'Portafolio'], emoji: '🖌️' },
    { id: 'mechanic', name: 'Mechanic', min: 50, max: 140, salary: 105, shiftsRequired: 8, deathRisk: false, requirements: ['Caja de herramientas', 'Manos firmes'], emoji: '🧰' },
    { id: 'electrician', name: 'Electrician', min: 55, max: 150, salary: 110, shiftsRequired: 10, deathRisk: true, requirements: ['Guantes aislantes', 'Normas de seguridad'], emoji: '⚡' },
    { id: 'nurse', name: 'Nurse', min: 55, max: 155, salary: 115, shiftsRequired: 10, deathRisk: true, requirements: ['Primeros auxilios', 'Resistencia'], emoji: '🩺' },
    { id: 'pilot', name: 'Pilot', min: 70, max: 190, salary: 150, shiftsRequired: 12, deathRisk: true, requirements: ['Licencia', 'Excelente salud'], emoji: '🛫' },
    { id: 'architect', name: 'Architect', min: 65, max: 185, salary: 145, shiftsRequired: 11, deathRisk: false, requirements: ['Planos', 'Precisión'], emoji: '📐' },
    { id: 'engineer', name: 'Engineer', min: 70, max: 200, salary: 160, shiftsRequired: 12, deathRisk: false, requirements: ['Cálculo', 'Resolución de problemas'], emoji: '🧪' },
    { id: 'scientist', name: 'Scientist', min: 75, max: 210, salary: 170, shiftsRequired: 14, deathRisk: true, requirements: ['Equipo de protección', 'Curiosidad'], emoji: '🔬' },
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
    const { Economy } = require('../Models/EconomySchema');

    try {
        await Economy.updateOne(
            { userId },
            { $setOnInsert: { userId, balance: 0, bank: 0, bankLevel: 0, sakuras: 0, inventory: [], workTotalEarned: 0, workShifts: 0 } },
            { upsert: true }
        );
    } catch (e) {
        if (e?.code !== 11000) throw e;
    }

    return Economy.findOne({ userId });
}

async function applyJob({ userId, jobId }) {
    if (!process.env.MONGODB) {
        return { ok: false, reason: 'no-db', message: 'MongoDB no está configurado (MONGODB vacío).' };
    }

    await ensureMongoConnection();
    const { Economy } = require('../Models/EconomySchema');

    const now = new Date();

    // Asegurar doc
    try {
        await Economy.updateOne(
            { userId },
            { $setOnInsert: { userId, balance: 0, bank: 0, bankLevel: 0, sakuras: 0, inventory: [], workTotalEarned: 0, workShifts: 0 } },
            { upsert: true }
        );
    } catch (e) {
        if (e?.code !== 11000) throw e;
    }

    const updated = await Economy.findOneAndUpdate(
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
    const { Economy } = require('../Models/EconomySchema');

    const updated = await Economy.findOneAndUpdate(
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
    const { Economy } = require('../Models/EconomySchema');

    // Asegurar doc
    try {
        await Economy.updateOne(
            { userId },
            { $setOnInsert: { userId, balance: 0, bank: 0, bankLevel: 0, sakuras: 0, inventory: [], workTotalEarned: 0, workShifts: 0 } },
            { upsert: true }
        );
    } catch (e) {
        if (e?.code !== 11000) throw e;
    }

    const existing = await Economy.findOne({ userId });
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
    const fixedSalary = Number.isFinite(Number(job.salary)) ? Math.max(0, Math.trunc(job.salary)) : null;
    const amount = fixedSalary !== null ? fixedSalary : rollAmount(job.min, job.max);

    const claimFilter = {
        userId,
        $or: [
            { lastWork: { $exists: false } },
            { lastWork: null },
            { lastWork: { $lte: cutoff } },
        ],
    };

    const updated = await Economy.findOneAndUpdate(
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
    const { Economy } = require('../Models/EconomySchema');

    const n = Math.max(1, Math.min(25, safeInt(limit, 10)));
    const rows = await Economy.find({}, { userId: 1, balance: 1 })
        .sort({ balance: -1 })
        .limit(n);

    return {
        ok: true,
        rows: rows.map(r => ({ userId: r.userId, balance: safeInt(r.balance, 0) })),
    };
}

async function getTopByJob({ jobId, limit = 10 } = {}) {
    if (!process.env.MONGODB) {
        return { ok: false, reason: 'no-db', message: 'MongoDB no está configurado (MONGODB vacío).' };
    }

    const id = String(jobId || '').trim();
    if (!id) {
        return { ok: false, reason: 'missing-job', message: 'Falta jobId.' };
    }

    await ensureMongoConnection();
    const { Economy } = require('../Models/EconomySchema');

    const n = Math.max(1, Math.min(25, safeInt(limit, 10)));
    const rows = await Economy.find(
        { workJobId: id },
        { userId: 1, workTotalEarned: 1, workShifts: 1, balance: 1 }
    )
        .sort({ workTotalEarned: -1, workShifts: -1, balance: -1 })
        .limit(n);

    return {
        ok: true,
        rows: rows.map(r => ({
            userId: r.userId,
            totalEarned: safeInt(r.workTotalEarned, 0),
            shifts: safeInt(r.workShifts, 0),
            balance: safeInt(r.balance, 0),
        })),
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
    getTopByJob,
};
