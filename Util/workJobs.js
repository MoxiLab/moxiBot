const { assertValidItemId } = require('./inventoryCatalog');

function randInt(min, max) {
    const a = Math.ceil(Number(min));
    const b = Math.floor(Number(max));
    if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return 0;
    return a + Math.floor(Math.random() * (b - a + 1));
}

function pickOne(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)] || null;
}

function weightedPick(items) {
    const rows = Array.isArray(items) ? items.filter((x) => x && Number.isFinite(x.weight) && x.weight > 0) : [];
    if (!rows.length) return null;
    const total = rows.reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * total;
    for (const r of rows) {
        roll -= r.weight;
        if (roll <= 0) return r;
    }
    return rows[rows.length - 1];
}

const JOBS = Object.freeze({
    minero: {
        label: 'Minero',
        description: 'Excava y encuentra minerales raros.',
        coinRange: [20, 55],
        activities: [
            'Picaste en una veta brillante y sacaste materiales.',
            'Encontraste una cueva oculta llena de recursos.',
            'Tu pico golpeó algo duro… ¡era un mineral elemental!',
        ],
        rewards: [
            { itemId: 'materiales/roca-volcanica', weight: 4, amountRange: [1, 2] },
            { itemId: 'materiales/mineral-elemental', weight: 3, amountRange: [1, 1] },
            { itemId: 'materiales/fosil', weight: 2, amountRange: [1, 1] },
            { itemId: 'materiales/barra-de-oro-acero', weight: 1, amountRange: [1, 1] },
        ],
    },
    pescador: {
        label: 'Pescador',
        description: 'Pesca y consigue botín del agua.',
        coinRange: [15, 45],
        activities: [
            'Lanzaste la caña y esperaste pacientemente…',
            '¡Picó algo enorme! Recuperaste el botín.',
            'La corriente trajo un objeto extraño hacia tu anzuelo.',
        ],
        rewards: [
            { itemId: 'materiales/fragmento-de-espiritu', weight: 3, amountRange: [1, 1] },
            { itemId: 'consumibles/electrolito', weight: 3, amountRange: [1, 2] },
            { itemId: 'consumibles/ensalada-refrescante', weight: 2, amountRange: [1, 1] },
            { itemId: 'buffs/pez-lumina', weight: 1, amountRange: [1, 1] },
        ],
    },
    recolector: {
        label: 'Recolector',
        description: 'Recolecta plantas y materiales del bosque.',
        coinRange: [10, 35],
        activities: [
            'Cosechaste plantas raras entre la hierba.',
            'Encontraste un claro lleno de flores especiales.',
            'Seguiste un rastro brillante hasta un recurso prisma.',
        ],
        rewards: [
            { itemId: 'materiales/hierba-prisma', weight: 5, amountRange: [1, 3] },
            { itemId: 'materiales/flor-de-amor', weight: 3, amountRange: [1, 2] },
            { itemId: 'consumibles/fruta-magica', weight: 2, amountRange: [1, 1] },
            { itemId: 'buffs/trebol-de-fortuna', weight: 1, amountRange: [1, 1] },
        ],
    },
    cocinero: {
        label: 'Cocinero',
        description: 'Prepara comidas para recuperar energía.',
        coinRange: [12, 40],
        activities: [
            'Cocinaste algo delicioso y lo vendiste rápido.',
            'Mejoraste tu receta y obtuviste un extra.',
            'Atendiste pedidos sin parar durante una hora.',
        ],
        rewards: [
            { itemId: 'consumibles/galleta-energetica', weight: 4, amountRange: [1, 2] },
            { itemId: 'consumibles/pastel-de-celebracion', weight: 2, amountRange: [1, 1] },
            { itemId: 'materiales/dulce-festivo', weight: 2, amountRange: [1, 2] },
            { itemId: 'buffs/pan-dulce-moxi', weight: 1, amountRange: [1, 1] },
        ],
    },
    artesano: {
        label: 'Artesano',
        description: 'Crea herramientas y mejoras.',
        coinRange: [18, 50],
        activities: [
            'Forjaste piezas con un acabado perfecto.',
            'Ajustaste mecanismos y mejoraste la calidad.',
            'Conseguiste un encargo especial y lo completaste.',
        ],
        rewards: [
            { itemId: 'herramientas/llave-multiusos', weight: 2, amountRange: [1, 1] },
            { itemId: 'herramientas/revelador-prisma', weight: 2, amountRange: [1, 1] },
            { itemId: 'mejoras/potenciador-de-fortuna', weight: 1, amountRange: [1, 1] },
            { itemId: 'mejoras/trabajo-en-equipo', weight: 1, amountRange: [1, 1] },
        ],
    },
});

function getJobsList() {
    return Object.entries(JOBS).map(([key, j]) => ({ key, ...j }));
}

function getJob(jobKey) {
    const key = String(jobKey || '').trim().toLowerCase();
    return JOBS[key] ? { key, ...JOBS[key] } : null;
}

function resolveJobKey(raw) {
    const key = String(raw || '').trim().toLowerCase();
    if (JOBS[key]) return key;

    // Allow matching by label (e.g. "minero")
    const needle = key
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');

    for (const [k, j] of Object.entries(JOBS)) {
        const label = String(j.label || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '');
        if (label === needle) return k;
    }

    return null;
}

function validateJobRewards() {
    for (const [key, job] of Object.entries(JOBS)) {
        for (const reward of job.rewards || []) {
            try {
                assertValidItemId(reward.itemId);
            } catch (err) {
                const e = new Error(`Invalid reward itemId for job ${key}: ${reward.itemId}`);
                e.cause = err;
                throw e;
            }
        }
    }
}

function rollWork(jobKey) {
    const job = getJob(jobKey);
    if (!job) return null;

    const activity = pickOne(job.activities) || 'Trabajaste duro y obtuviste recompensa.';
    const coins = randInt(job.coinRange[0], job.coinRange[1]);

    const rewardRow = weightedPick(job.rewards);
    const itemId = rewardRow?.itemId || null;
    const itemAmount = rewardRow ? Math.max(1, randInt(rewardRow.amountRange?.[0] ?? 1, rewardRow.amountRange?.[1] ?? 1)) : 0;

    return {
        jobKey: job.key,
        jobLabel: job.label,
        activity,
        coins,
        itemId,
        itemAmount,
    };
}

module.exports = {
    JOBS,
    getJobsList,
    getJob,
    resolveJobKey,
    validateJobRewards,
    rollWork,
};
