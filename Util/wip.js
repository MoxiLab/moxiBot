const { buildNoticeContainer, asV2MessageOptions } = require('./v2Notice');
const { EMOJIS } = require('./emojis');
const moxi = require('../i18n');

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

    return asV2MessageOptions(
        buildNoticeContainer({
            emoji,
            title: resolvedTitle,
            text: resolvedText,
        })
    );
}

module.exports = {
    buildWipPayload,
};
