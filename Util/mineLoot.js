const { randInt } = require('./activityUtils');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function chance(p) {
    return Math.random() < p;
}

/**
 * Devuelve drops de materiales para minería.
 * - Mantiene IDs existentes desde Languages/<locale>/economy/items.json.
 */
function rollMineMaterials(zone, activity) {
    const requiredId = String(zone?.requiredItemId || '');
    const isExplosive = requiredId.includes('dinamita');

    const actId = String(activity?.id || '');
    const luckBoost = actId === 'sondear-grietas' ? 0.05 : 0;
    const barBoost = actId === 'cribar-escombros' ? 0.10 : 0;
    const fragBoost = actId === 'sondear-grietas' ? 0.04 : 0;

    const drops = [];

    // Base: siempre algo de mineral
    drops.push({ itemId: 'materiales/mineral-elemental', amount: isExplosive ? randInt(2, 5) : randInt(1, 3) });

    // Rocas volcánicas como "piedra" de minería
    if (isExplosive) {
        drops.push({ itemId: 'materiales/roca-volcanica', amount: randInt(1, 3) });
    } else if (chance(0.65 + luckBoost)) {
        drops.push({ itemId: 'materiales/roca-volcanica', amount: randInt(1, 2) });
    }

    // Barra Oro/Acero: menos frecuente
    if (isExplosive ? chance(0.45 + barBoost) : chance(0.20 + barBoost)) {
        drops.push({ itemId: 'materiales/barra-de-oro-acero', amount: isExplosive ? randInt(1, 2) : 1 });
    }

    // Fragmento de espíritu: muy raro
    if (isExplosive ? chance(0.12 + fragBoost) : chance(0.05 + fragBoost)) {
        drops.push({ itemId: 'materiales/fragmento-de-espiritu', amount: 1 });
    }

    // Normalizar: quitar cantidades inválidas
    return drops
        .map(d => ({ itemId: d.itemId, amount: Math.max(1, safeInt(d.amount, 1)) }))
        .filter(Boolean);
}

module.exports = {
    rollMineMaterials,
};
