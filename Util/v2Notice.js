const { ContainerBuilder, MessageFlags } = require('discord.js');
const { Bot } = require('../Config');

function buildNoticeContainer({ title, text, emoji, accentColor } = {}) {
    const container = new ContainerBuilder().setAccentColor(accentColor ?? Bot.AccentColor);

    if (title) {
        const header = emoji ? `# ${emoji} ${title}` : `# ${title}`;
        container.addTextDisplayComponents(c => c.setContent(header));
        container.addSeparatorComponents(s => s.setDivider(true));
    }

    if (text) {
        container.addTextDisplayComponents(c => c.setContent(String(text)));
    }

    return container;
}

function asV2MessageOptions(container) {
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {
    buildNoticeContainer,
    asV2MessageOptions,
};
