const { ActionRowBuilder, SecondaryButtonBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { EMOJIS, toEmojiObject } = require('./emojis');

function buildEmojiPaginationRow(currentPage, totalPages, translate, options = {}) {
    const disableAll = Boolean(options.disableAll);
    const prevBtn = new SecondaryButtonBuilder()
        .setCustomId('addemoji-list-prev')
        .setEmoji(toEmojiObject(EMOJIS.arrowLeft))
        .setDisabled(disableAll || currentPage <= 0);
    const homeBtn = new SecondaryButtonBuilder()
        .setCustomId('addemoji-list-home')
        .setEmoji(toEmojiObject(EMOJIS.home))
        .setDisabled(disableAll || currentPage === 0);
    const closeBtn = new SecondaryButtonBuilder()
        .setCustomId('addemoji-list-close')
        .setEmoji(toEmojiObject(EMOJIS.cross))
        .setDisabled(disableAll);
    const infoBtn = new SecondaryButtonBuilder()
        .setCustomId('addemoji-list-info')
        .setEmoji(toEmojiObject(EMOJIS.question))
        .setDisabled(disableAll);
    const nextBtn = new SecondaryButtonBuilder()
        .setCustomId('addemoji-list-next')
        .setEmoji(toEmojiObject(EMOJIS.arrowRight))
        .setDisabled(disableAll || currentPage >= totalPages - 1);

    return new ActionRowBuilder().addComponents(prevBtn, homeBtn, closeBtn, infoBtn, nextBtn);
}

function createPageNavigationModal(translate, helperText) {
    const title = translate('misc:ADDEMOJI_NAV_PAGE_TITLE') || 'Ir a página';
    const label = translate('misc:ADDEMOJI_NAV_PAGE_LABEL') || 'Número de página';
    const placeholder = translate('misc:ADDEMOJI_NAV_PAGE_PLACEHOLDER') || 'Escribe 1 para la página inicial';

    return new ModalBuilder()
        .setCustomId('addemoji-nav-page-modal')
        .setTitle(title)
        .addComponents(
            new TextInputBuilder()
                .setCustomId('addemoji-nav-page-field')
                .setLabel(label)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(helperText || placeholder)
                .setRequired(true)
        );
}

module.exports = {
    buildEmojiPaginationRow,
    createPageNavigationModal,
};
