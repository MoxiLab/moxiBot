const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const {
    parseMinesweeperCustomId,
    unpackState,
    newGameState,
    applyOpenCell,
    toggleFlagAt,
    buildMinesweeperMessageOptions,
} = require('../../../../Util/minesweeper');

module.exports = async function minesweeperButtons(interaction) {
    if (!interaction.isButton?.()) return false;

    const parsed = parseMinesweeperCustomId(interaction.customId);
    if (!parsed) return false;

    const { action, userId, parts } = parsed;

    if (action === 'noop') {
        await interaction.deferUpdate().catch(() => null);
        return true;
    }

    if (interaction.user?.id !== String(userId)) {
        const lang = interaction.lang || interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES';
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: moxi.translate('misc:ONLY_AUTHOR_BUTTONS', lang) })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    const lang = interaction.lang || interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES';

    const sanitizePayloadForUpdate = (payload) => {
        if (!payload) return payload;
        // `interaction.update()` does not accept `flags`.
        if (Object.prototype.hasOwnProperty.call(payload, 'flags')) delete payload.flags;
        return payload;
    };

    if (action === 'n') {
        const state = { ...newGameState(), mode: 'open' };
        const payload = sanitizePayloadForUpdate(buildMinesweeperMessageOptions({ userId, lang, state }));
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (action === 'close') {
        const stateStr = parts[3];
        const base = unpackState(stateStr);
        const state = { ...base, mode: 'open' };
        const payload = sanitizePayloadForUpdate(buildMinesweeperMessageOptions({ userId, lang, state, disabled: true }));
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (action === 'mode') {
        const nextMode = parts[3] || 'open';
        const stateStr = parts[4];
        const base = unpackState(stateStr);
        const state = { ...base, mode: nextMode };
        const payload = sanitizePayloadForUpdate(buildMinesweeperMessageOptions({ userId, lang, state }));
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (action === 'o' || action === 'g') {
        const x = Number.parseInt(parts[3], 10);
        const y = Number.parseInt(parts[4], 10);
        const stateStr = parts[5];
        const base = unpackState(stateStr);

        let next = { ...base, mode: action === 'g' ? 'flag' : 'open' };

        if (action === 'g') {
            next = toggleFlagAt({ state: next, x, y });
            next.mode = 'flag';
        } else {
            next = applyOpenCell({ state: next, x, y });
            next.mode = 'open';
        }

        const payload = sanitizePayloadForUpdate(buildMinesweeperMessageOptions({ userId, lang, state: next }));
        await interaction.update(payload).catch(() => null);
        return true;
    }

    return true;
};
