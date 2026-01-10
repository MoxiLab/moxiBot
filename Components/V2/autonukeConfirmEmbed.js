const { ContainerBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');

// Components V2: confirmación de autonuke
module.exports = function buildAutonukeConfirmEmbed({ lang = 'es-ES', channelId }) {
    return new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.bomb} ${moxi.translate('AUTONUKE_TITLE', lang)}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(moxi.translate('AUTONUKE_DESC', lang, { channel: `<#${channelId}>` })));
};
