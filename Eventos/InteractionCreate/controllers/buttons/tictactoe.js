const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const {
    parseTttCustomId,
    buildTttMessageOptions,
    unpackBoard,
    applyHumanMove,
    applyBotMove,
    winner,
} = require('../../../../Util/tictactoe');

module.exports = async function tictactoeButtons(interaction) {
    if (!interaction.isButton?.()) return false;

    const parsed = parseTttCustomId(interaction.customId);
    if (!parsed) return false;

    const { action, userId, pos, packed } = parsed;

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

    const sanitizePayloadForEdit = (payload) => {
        if (!payload) return payload;
        if (Object.prototype.hasOwnProperty.call(payload, 'flags')) delete payload.flags;
        return payload;
    };

    const updateGameMessage = async (payload) => {
        const clean = sanitizePayloadForEdit(payload);
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate().catch(() => null);
            }
            await interaction.editReply(clean);
            return;
        } catch (error) {
            try {
                await interaction.message?.edit?.(clean);
                return;
            } catch (error2) {
                console.error('[tictactoe] failed to update message', error2 || error);
                try {
                    await interaction.followUp({
                        content: moxi.translate('misc:ERROR', lang) || 'Error',
                        flags: MessageFlags.Ephemeral,
                    });
                } catch { }
            }
        }
    };

    if (action === 'n') {
        await updateGameMessage(buildTttMessageOptions({ userId, lang, board: Array(9).fill(0) }));
        return true;
    }

    if (action === 'close') {
        const board = unpackBoard(packed);
        await updateGameMessage(buildTttMessageOptions({ userId, lang, board, disabled: true }));
        return true;
    }

    if (action === 'm') {
        const human = applyHumanMove({ packed, pos });
        let board = human.board;

        if (human.changed) {
            const w = winner(board);
            if (w === 0) {
                const bot = applyBotMove(board);
                board = bot.board;
            }
        }

        await updateGameMessage(buildTttMessageOptions({ userId, lang, board }));
        return true;
    }

    // Unknown action: consume
    await interaction.deferUpdate().catch(() => null);
    return true;
};
