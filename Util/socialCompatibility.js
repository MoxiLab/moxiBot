function fnv1a32(input) {
    const str = String(input || '');
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function clampInt(n, min, max) {
    const x = Math.trunc(Number(n));
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
}

function hasRelationship(doc, otherId) {
    const rels = Array.isArray(doc?.relationships) ? doc.relationships : [];
    return rels.some((r) => String(r?.userId || '') === String(otherId || ''));
}

function isMarriedWith(doc, otherId) {
    return String(doc?.marriage?.spouse || '') === String(otherId || '');
}

function computeSocialCompatibility({ guildId, userAId, userBId, docA, docB }) {
    const ids = [String(userAId || ''), String(userBId || '')].sort();
    const seed = `${ids[0]}:${ids[1]}`;
    const base = fnv1a32(seed) % 101;

    let bonus = 0;
    const reasons = [];

    if (isMarriedWith(docA, userBId) && isMarriedWith(docB, userAId)) {
        bonus += 25;
        reasons.push('Pareja casada (+25)');
    }

    const aToB = hasRelationship(docA, userBId);
    const bToA = hasRelationship(docB, userAId);

    if (aToB && bToA) {
        bonus += 14;
        reasons.push('Relacion mutua (+14)');
    } else if (aToB || bToA) {
        bonus += 7;
        reasons.push('Relacion registrada (+7)');
    }

    const score = clampInt(base + bonus, 0, 100);

    let tier = 'Normal';
    if (score >= 85) tier = 'Perfecta';
    else if (score >= 70) tier = 'Alta';
    else if (score >= 45) tier = 'Media';

    return {
        score,
        base,
        bonus,
        tier,
        reasons,
    };
}

module.exports = {
    computeSocialCompatibility,
};
