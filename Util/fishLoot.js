const { randInt } = require('./activityUtils');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function chance(p) {
    return Math.random() < p;
}

function zoneTier(zone) {
    const req = String(zone?.requiredItemId || '');

    if (req.includes('revelador-prisma')) return 4; // tesoro
    if (req.includes('dinamita')) return 3; // bloqueadas
    if (req.includes('linterna-solar')) return 3; // oscuras
    if (req.includes('barco-moxi')) return 2; // marítimas
    if (req.includes('golem-minero-pescador')) return 2; // automático
    return 1; // caña
}

/**
 * Devuelve drops de materiales para pesca.
 * - Usa IDs existentes del catálogo o añadidos en Models/InventoryItems.json.
 */
function rollFishMaterials(zone, activity) {
    const tier = zoneTier(zone);
    const actId = String(activity?.id || '');

    const luckBoost = actId === 'lanzar-red' ? 0.05 : 0;
    const treasureBoost = actId === 'buscar-tesoro' ? 0.06 : 0;

    const drops = [];

    // Base: siempre algo del mar
    drops.push({ itemId: 'materiales/alga-marina', amount: tier >= 2 ? randInt(2, 5) : randInt(1, 3) });

    // Conchas: común
    if (chance(0.60 + luckBoost)) {
        drops.push({ itemId: 'materiales/concha-marina', amount: tier >= 3 ? randInt(1, 3) : randInt(1, 2) });
    }

    // Coral: más típico en zonas marítimas / tier alto
    if (tier >= 2 && chance(0.25 + luckBoost)) {
        drops.push({ itemId: 'materiales/coral-prisma', amount: randInt(1, 2) });
    }

    // Fósil: zonas oscuras / explosivas (representa hallazgos raros en cuevas/tuberías)
    if (tier >= 3 && chance(0.14 + luckBoost)) {
        drops.push({ itemId: 'materiales/fosil', amount: 1 });
    }

    // Perla: tesoro (revelador prisma)
    if (tier >= 4 && chance(0.10 + luckBoost + treasureBoost)) {
        drops.push({ itemId: 'materiales/perla-azur', amount: 1 });
    }

    // Fragmento de espíritu: muy raro, solo en tesoro
    if (tier >= 4 && chance(0.04 + treasureBoost)) {
        drops.push({ itemId: 'materiales/fragmento-de-espiritu', amount: 1 });
    }

    return drops
        .map(d => ({ itemId: d.itemId, amount: Math.max(1, safeInt(d.amount, 1)) }))
        .filter(Boolean);
}

module.exports = {
    rollFishMaterials,
};
