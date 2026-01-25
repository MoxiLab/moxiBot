const { ContainerBuilder, ButtonStyle } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');
const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');

function createEmojiContainer({ header, body, detail, actionRows = [] }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents((c) => c.setContent(header))
        .addSeparatorComponents((s) => s.setDivider(true))
        .addTextDisplayComponents((c) => c.setContent(body));

    if (detail) {
        container
            .addSeparatorComponents((s) => s.setDivider(true))
            .addTextDisplayComponents((c) => c.setContent(detail));
    }

    actionRows.forEach((row) => {
        container.addActionRowComponents((builder) => builder.addComponents(row.components));
    });

    return container;
}

function finalizeEmojiContainer(container, client, translateFn) {
    const webLabel = translateFn('HELP_WEB_LABEL') || 'Help';
    const webUrl = translateFn('HELP_WEB_URL') || 'https://moxilab.net/';
    return container
        .addSeparatorComponents((s) => s.setDivider(true))
        .addActionRowComponents((row) =>
            row.addComponents(
                new ButtonBuilder()
                    .setLabel(webLabel)
                    .setStyle(ButtonStyle.Link)
                    .setURL(webUrl)
                    .setEmoji(EMOJIS.globe)
            )
        )
        .addSeparatorComponents((s) => s.setDivider(true))
        .addTextDisplayComponents((c) =>
            c.setContent(`${EMOJIS.copyright} ${client.user.username} • ${new Date().getFullYear()}`)
        );
}

module.exports = {
    createEmojiContainer,
    finalizeEmojiContainer,
};
