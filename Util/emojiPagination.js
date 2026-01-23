const { ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');
const { EMOJIS } = require('./emojis');

function buildEmojiPaginationRow(currentPage, totalPages, translate, options = {}) {
    const disableAll = Boolean(options.disableAll);
    const prevBtn = new ButtonBuilder()
        .setCustomId('addemoji-list-prev')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.arrowLeft)
        .setDisabled(disableAll || currentPage <= 0);
    const homeBtn = new ButtonBuilder()
        .setCustomId('addemoji-list-home')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.home)
        .setDisabled(disableAll || currentPage === 0);
    const closeBtn = new ButtonBuilder()
        .setCustomId('addemoji-list-close')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.cross)
        .setDisabled(disableAll);
    const infoBtn = new ButtonBuilder()
        .setCustomId('addemoji-list-info')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.question)
        .setDisabled(disableAll);
    const nextBtn = new ButtonBuilder()
        .setCustomId('addemoji-list-next')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.arrowRight)
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
