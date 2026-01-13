const { ContainerBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');

// Components V2: mensaje informativo tras ejecutar autonuke
module.exports = function buildAutonukeEmbed({ lang = 'es-ES', authorId } = {}) {
    const executedBy = authorId ? `\n${moxi.translate('EXECUTED_BY', lang)} <@${authorId}>` : '';

    return new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c =>
            c.setContent(`# ${EMOJIS.bomb} ${moxi.translate('AUTONUKE_TITLE', lang)}`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`${moxi.translate('AUTONUKE_DESCRIPTION', lang)}${executedBy}`)
        );
};
