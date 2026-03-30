const { buildNoticeContainer, asV2MessageOptions } = require('./v2Notice');
const { EMOJIS } = require('./emojis');
const moxi = require('../i18n');

const DEFAULT_PREFIX = process.env.PREFIX || '.';

// Sugerencias por comando (clave: nombre/título en minúsculas)
// Objetivo: que el usuario vea alternativas útiles en vez del típico “se añadirá pronto”.
const WIP_SUGGESTIONS = {
    // Economy
    fortune: ['daily', 'work', 'bal'],
    market: ['shop', 'buy', 'sell'],
    servershop: ['shop', 'buy'],
    storage: ['bag', 'inventory'],
    trade: ['give', 'gift'],
    share: ['give', 'gift'],
    slots: ['roulette'],
    leaderboard: ['work top', 'levels', 'rank'],
    quest: ['daily', 'work', 'crime'],
    repair: ['iteminfo', 'shop'],
    mix: ['craft'],
    xmas: ['daily', 'event'],
    claimcode: ['daily', 'event'],
    chop: ['work', 'mine', 'fish'],
    guide: ['help', 'shop', 'bag'],
    settings: ['help', 'balance', 'shop'],
};

function isUntranslated(key, value) {
    if (value === undefined || value === null) return true;
    const v = String(value);
    if (!v) return true;
    if (v === key) return true;
    const withoutNs = String(key).includes(':') ? String(key).split(':').pop() : String(key);
    if (v === withoutNs) return true;
    return false;
}

function resolveSuggestions(titleOrName) {
    const k = String(titleOrName || '').trim().toLowerCase();
    if (!k) return null;
    return WIP_SUGGESTIONS[k] || null;
}

function formatSuggestions(prefix, arr) {
    const p = (typeof prefix === 'string' && prefix.trim()) ? prefix.trim() : DEFAULT_PREFIX;
    const list = Array.isArray(arr) ? arr : [];
    const parts = list
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((s) => `\`${p}${s}\``);
    return parts.length ? parts.join(' ') : '';
}

function buildWipPayload({
    lang = null,
    title = null,
    text = null,
    emoji = (EMOJIS.info || 'ℹ️'),
} = {}) {
    const resolvedLang = (typeof lang === 'string' && lang.trim())
        ? lang.trim()
        : (process.env.DEFAULT_LANG || 'es-ES');

    const resolvedTitle = (title != null && String(title).trim())
        ? String(title)
        : (moxi.translate('misc:WIP_TITLE', resolvedLang) || 'En desarrollo');

    const resolvedText = (text != null && String(text).trim())
        ? String(text)
        : (moxi.translate('misc:WIP_TEXT', resolvedLang) || 'Este comando aún está en desarrollo. Lo añadiremos pronto.');

    // Añadir sugerencias si hay alternativas para este comando.
    let finalText = resolvedText;
    const suggestions = resolveSuggestions(resolvedTitle);
    if (suggestions && suggestions.length) {
        const formatted = formatSuggestions(DEFAULT_PREFIX, suggestions);
        if (formatted) {
            const hintKey = 'misc:WIP_TRY_INSTEAD';
            const hint = moxi.translate(hintKey, resolvedLang, { commands: formatted });
            const fallbackHint = /^es(-|$)/i.test(resolvedLang)
                ? `Mientras tanto, prueba: ${formatted}`
                : `In the meantime, try: ${formatted}`;

            finalText = `${resolvedText}\n\n${(!isUntranslated(hintKey, hint) ? hint : fallbackHint)}`;
        }
    }

    return asV2MessageOptions(
        buildNoticeContainer({
            emoji,
            title: resolvedTitle,
            text: finalText,
        })
    );
}

module.exports = {
    buildWipPayload,
};
