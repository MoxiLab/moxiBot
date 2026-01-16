function randInt(min, max) {
    const a = Math.min(min, max);
    const b = Math.max(min, max);
    return Math.floor(a + Math.random() * (b - a + 1));
}

function chance(p) {
    const x = Number(p);
    const prob = Number.isFinite(x) ? x : 0;
    return Math.random() < Math.max(0, Math.min(1, prob));
}

function pickRandom(list) {
    const arr = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!arr.length) return null;
    return arr[randInt(0, arr.length - 1)] || null;
}

function clampInt(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, Math.trunc(x)));
}

function scaleRange(minAmount, maxAmount, multiplier) {
    const m = Number(multiplier);
    const mul = Number.isFinite(m) ? m : 1;

    const min = clampInt(Math.round(minAmount * mul), 1, Number.MAX_SAFE_INTEGER);
    const max = clampInt(Math.round(maxAmount * mul), min, Number.MAX_SAFE_INTEGER);
    return { min, max };
}

module.exports = {
    randInt,
    chance,
    pickRandom,
    clampInt,
    scaleRange,
};
