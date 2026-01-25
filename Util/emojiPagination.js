const { ActionRowBuilder, ButtonStyle, LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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

    const modal = new ModalBuilder()
        .setCustomId('addemoji-nav-page-modal')
        .setTitle(title);

    const input = new TextInputBuilder()
        .setCustomId('addemoji-nav-page-field')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(placeholder)
        .setRequired(true);

    // Compat discord.js v14 (TextInputBuilder tenía label en el propio input)
    if (typeof input.setLabel === 'function') {
        input.setLabel(label);
        if (typeof modal.addComponents === 'function') {
            const row = new ActionRowBuilder().addComponents(input);
            modal.addComponents(row);
            return modal;
        }
    }

    // discord.js dev/v15: el texto del label va en un LabelBuilder que envuelve al TextInput
    if (typeof modal.addLabelComponents === 'function' && typeof LabelBuilder === 'function') {
        const labelComp = new LabelBuilder().setLabel(label).setTextInputComponent(input);
        const desc = String(helperText || '').trim();
        if (desc && typeof labelComp.setDescription === 'function') {
            labelComp.setDescription(desc);
        }
        modal.addLabelComponents(labelComp);
        return modal;
    }

    // Último fallback (si el modal no soporta addLabelComponents pero sí addComponents)
    if (typeof modal.addComponents === 'function') {
        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
    }

    return modal;
}

module.exports = {
    buildEmojiPaginationRow,
    createPageNavigationModal,
};
