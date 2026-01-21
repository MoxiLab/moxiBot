const moxi = require('../i18n');

function normalizeLang(lang, fallback = 'es-ES') {
    const s = String(lang || '').trim();
    return s || fallback;
}

function makeCategory(nsKey, fallback = 'es-ES') {
    const key = String(nsKey || '').trim();
    if (!key) {
        return (lang) => moxi.translate('commands:CATEGORY_HERRAMIENTAS', normalizeLang(lang, fallback));
    }

    return (lang) => moxi.translate(key, normalizeLang(lang, fallback));
}

const economyCategory = makeCategory('commands:CATEGORY_ECONOMIA');
const moderationCategory = makeCategory('commands:CATEGORY_MODERATION');
const adminCategory = makeCategory('commands:CATEGORY_ADMIN');
const toolsCategory = makeCategory('commands:CATEGORY_HERRAMIENTAS');
const musicCategory = makeCategory('commands:CATEGORY_MUSICA');
const funCategory = makeCategory('commands:CATEGORY_FUN');
const rootCategory = makeCategory('commands:CATEGORY_ROOT');

module.exports = {
    makeCategory,
    economyCategory,
    moderationCategory,
    adminCategory,
    toolsCategory,
    musicCategory,
    funCategory,
    rootCategory,
};
