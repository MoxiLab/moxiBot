const { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');

const AUTONUKE_GIF_URL =
    'https://media.discordapp.net/attachments/1297910771535056949/1298788107524636803/cat-cats-ezgif.com-video-to-gif-converter.gif';

// Components V2: panel resultado autonuke
module.exports = function buildAutonukeEmbed({ lang = 'es-ES', authorId }) {
    return new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.bomb} ${(moxi.translate('AUTONUKE_TITLE', lang) || 'Canal recreado')}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent((moxi.translate('AUTONUKE_DESCRIPTION', lang) || '') + `\n${moxi.translate('EXECUTED_BY', lang)} <@${authorId}>`)
        )
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(AUTONUKE_GIF_URL))
        );
};
