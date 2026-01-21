const { ContainerBuilder, MessageFlags } = require('discord.js');
const { Bot } = require('../Config');
const { getCommandContext } = require('./commandContext');

function formatExecutorFooter(ctx) {
    const userId = ctx && ctx.userId ? String(ctx.userId) : '';
    const tag = ctx && ctx.userTag ? String(ctx.userTag) : '';
    if (userId && tag) return `Ejecutado por <@${userId}> (${tag})`;
    if (userId) return `Ejecutado por <@${userId}>`;
    if (tag) return `Ejecutado por ${tag}`;
    return null;
}

function maybeApplyEconomyFooter(container, footerText, footerDivider = true) {
    if (!container || typeof container.addTextDisplayComponents !== 'function') return;

    const ctx = getCommandContext();
    if (!ctx || !ctx.isEconomy) return;

    // Si ya se indicó footer explícito, respetarlo.
    if (footerText) return;

    // Evitar duplicar footer si ya se aplicó.
    if (container.__moxiEconomyFooterApplied) return;

    const text = formatExecutorFooter(ctx);
    if (!text) return;

    if (footerDivider && typeof container.addSeparatorComponents === 'function') {
        container.addSeparatorComponents(s => s.setDivider(true));
    }
    container.addTextDisplayComponents(c => c.setContent(String(text)));
    container.__moxiEconomyFooterApplied = true;
}

function buildNoticeContainer({ title, text, emoji, accentColor, footerText, footerDivider = true } = {}) {
    const container = new ContainerBuilder().setAccentColor(accentColor ?? Bot.AccentColor);

    if (title) {
        const header = emoji ? `# ${emoji} ${title}` : `# ${title}`;
        container.addTextDisplayComponents(c => c.setContent(header));
        container.addSeparatorComponents(s => s.setDivider(true));
    }

    if (text) {
        container.addTextDisplayComponents(c => c.setContent(String(text)));
    }

    if (footerText) {
        if (footerDivider) {
            container.addSeparatorComponents(s => s.setDivider(true));
        }
        container.addTextDisplayComponents(c => c.setContent(String(footerText)));
    }

    // Auto-footer para comandos de Economy (si no hay footer explícito)
    maybeApplyEconomyFooter(container, footerText, footerDivider);

    return container;
}

function asV2MessageOptions(container) {
    // Para contenedores construidos a mano (no via buildNoticeContainer)
    maybeApplyEconomyFooter(container, null, true);
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {
    buildNoticeContainer,
    asV2MessageOptions,
};
