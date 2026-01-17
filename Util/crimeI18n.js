const moxi = require('../i18n');

function tCrime(lang, key, vars = {}) {
    const fullKey = String(key || '').includes(':') ? String(key) : `economy/crime:${key}`;
    const res = moxi.translate(fullKey, lang, vars);
    if (!res) return '';

    const idx = fullKey.indexOf(':');
    const keyPath = (idx >= 0) ? fullKey.slice(idx + 1) : '';
    if (res === fullKey) return '';
    if (keyPath && res === keyPath) return '';

    const firstToken = String(res).trim().split(/\s+/)[0] || '';
    if (firstToken.startsWith('__') && firstToken.endsWith('__')) return '';

    return res;
}

function crimeActivityTitle(lang, activity) {
    const l = String(lang || '').trim().toLowerCase();
    if ((l === 'es-es' || l.startsWith('es')) && activity?.title) return activity.title;
    const id = String(activity?.id || '').trim();
    return tCrime(lang, `activities.${id}.title`) || activity?.title || 'Crime';
}

function crimeActivityPrompt(lang, activity) {
    const l = String(lang || '').trim().toLowerCase();
    if ((l === 'es-es' || l.startsWith('es')) && activity?.prompt) return activity.prompt;
    const id = String(activity?.id || '').trim();
    return tCrime(lang, `activities.${id}.prompt`) || activity?.prompt || '';
}

function crimeOptionLabel(lang, optionId) {
    const id = String(optionId || '').trim();
    return tCrime(lang, `options.${id}`) || id;
}

function crimeDoorLabel(lang, doorId) {
    const id = String(doorId || '').trim();
    return tCrime(lang, `doors.${id}`) || id;
}

function crimeRiskLabel(lang, riskId) {
    const id = String(riskId || '').trim();
    return tCrime(lang, `risks.${id}`) || id;
}

function crimeWireLabel(lang, wireId) {
    const id = String(wireId || '').trim();
    return tCrime(lang, `wires.${id}`) || id;
}

module.exports = {
    tCrime,
    crimeActivityTitle,
    crimeActivityPrompt,
    crimeOptionLabel,
    crimeDoorLabel,
    crimeRiskLabel,
    crimeWireLabel,
};
