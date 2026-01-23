const {
    ContainerBuilder,
    DangerButtonBuilder,
    PrimaryButtonBuilder,
    SecondaryButtonBuilder,
    SuccessButtonBuilder,
    MessageFlags,
} = require('discord.js');
const moxi = require('../i18n');
const { Bot } = require('../Config');

function getStore(Moxi) {
    if (!Moxi.__modV2Pending) Moxi.__modV2Pending = new Map();
    return Moxi.__modV2Pending;
}

function createToken() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function putPending(Moxi, state, { ttlMs = 10 * 60 * 1000 } = {}) {
    const store = getStore(Moxi);
    const token = createToken();
    store.set(token, { ...state, createdAt: Date.now() });
    const timeout = setTimeout(() => store.delete(token), ttlMs);
    if (typeof timeout?.unref === 'function') timeout.unref();
    return token;
}

function buildConfirmV2({
    lang,
    title,
    lines,
    confirmCustomId,
    cancelCustomId,
    confirmStyle = 4,
    ephemeral = false,
}) {
    const confirmLabel = moxi.translate('AUTONUKE_CONFIRM', lang) || 'Confirmar';
    const cancelLabel = moxi.translate('AUTONUKE_CANCEL', lang) || 'Cancelar';

    function createConfirmButtonBuilder() {
        switch (confirmStyle) {
            case 1:
                return new PrimaryButtonBuilder();
            case 2:
                return new SecondaryButtonBuilder();
            case 3:
                return new SuccessButtonBuilder();
            case 4:
            default:
                return new DangerButtonBuilder();
        }
    }

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents((c) => c.setContent(`# ${title}`))
        .addSeparatorComponents((s) => s.setDivider(true));

    (Array.isArray(lines) ? lines : []).forEach((line) => {
        if (!line) return;
        container.addTextDisplayComponents((c) => c.setContent(line));
    });

    container
        .addSeparatorComponents((s) => s.setDivider(true))
        .addActionRowComponents((row) =>
            row.addComponents(
                createConfirmButtonBuilder().setCustomId(confirmCustomId).setLabel(confirmLabel),
                new SecondaryButtonBuilder().setCustomId(cancelCustomId).setLabel(cancelLabel)
            )
        );

    const payload = { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
    if (ephemeral) payload.ephemeral = true;
    return payload;
}

module.exports = {
    putPending,
    buildConfirmV2,
};
