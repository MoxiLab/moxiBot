const { ContainerBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');

const Config = require('../Config');
const moxi = require('../i18n');

function isUntranslated(key, value) {
    if (value === undefined || value === null) return true;
    const v = String(value);
    if (!v) return true;
    if (v === key) return true;
    const withoutNs = String(key).includes(':') ? String(key).split(':').pop() : String(key);
    if (v === withoutNs) return true;
    return false;
}

function tr(lang, key, fallback, vars) {
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
    const fullKey = key.includes(':') ? key : `misc:${key}`;
    const raw = moxi.translate(fullKey, safeLang, vars);
    if (isUntranslated(fullKey, raw)) return fallback;
    return raw;
}

function packBoard(board) {
    const b = Array.isArray(board) ? board : [];
    let n = 0;
    for (let i = 0; i < 9; i += 1) {
        const v = Number(b[i] || 0);
        n = (n * 3) + (v >= 0 && v <= 2 ? v : 0);
    }
    return n.toString(36);
}

function unpackBoard(packed) {
    const raw = String(packed || '').trim();
    const n = Number.parseInt(raw, 36);
    if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return Array(9).fill(0);

    const out = Array(9).fill(0);
    let x = n;
    for (let i = 8; i >= 0; i -= 1) {
        out[i] = x % 3;
        x = Math.floor(x / 3);
    }
    return out;
}

function winner(board) {
    const b = board;
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, c, d] of lines) {
        if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return 0;
}

function isFull(board) {
    return board.every((v) => v !== 0);
}

function findWinningMove(board, who) {
    for (let pos = 0; pos < 9; pos += 1) {
        if (board[pos] !== 0) continue;
        const copy = board.slice();
        copy[pos] = who;
        if (winner(copy) === who) return pos;
    }
    return -1;
}

function pickBotMove(board) {
    // 2 = bot (⭕), 1 = player (❌)
    const winPos = findWinningMove(board, 2);
    if (winPos >= 0) return winPos;

    const blockPos = findWinningMove(board, 1);
    if (blockPos >= 0) return blockPos;

    const pref = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    for (const pos of pref) {
        if (board[pos] === 0) return pos;
    }
    return -1;
}

function parseTttCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('ttt:')) return null;
    const parts = raw.split(':');
    return {
        action: parts[1],
        userId: parts[2],
        pos: parts[3] != null ? Number.parseInt(parts[3], 10) : null,
        packed: parts[4],
        parts,
    };
}

function buildCellButton({ userId, pos, board, packed, disabled }) {
    const v = board[pos];
    const isEmpty = v === 0;

    const btn = new ButtonBuilder();

    if (isEmpty) {
        btn
            .setCustomId(`ttt:m:${userId}:${pos}:${packed}`)
            .setLabel('\u200b')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(Boolean(disabled));
        return btn;
    }

    // Filled
    btn
        .setCustomId(`ttt:noop:${userId}:${pos}:${packed}`)
        .setLabel('\u200b')
        .setStyle(v === 1 ? ButtonStyle.Primary : ButtonStyle.Danger)
        .setEmoji(v === 1 ? '❌' : '⭕')
        .setDisabled(true);

    return btn;
}

function buildTttMessageOptions({ userId, lang, board, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
    const safeBoard = Array.isArray(board) ? board.slice(0, 9) : Array(9).fill(0);
    while (safeBoard.length < 9) safeBoard.push(0);

    const packed = packBoard(safeBoard);

    const accent = Config?.Bot?.AccentColor || 0x5865F2;
    const container = new ContainerBuilder().setAccentColor(accent);

    const title = tr(safeLang, 'GAMES_TTT_TITLE', 'Tres en raya');
    container.addTextDisplayComponents(c => c.setContent(`## 🕹️ ${title}`));
    container.addSeparatorComponents(s => s.setDivider(true));

    const w = winner(safeBoard);
    let status;
    if (w === 1) status = tr(safeLang, 'GAMES_TTT_WIN', '¡Ganaste!');
    else if (w === 2) status = tr(safeLang, 'GAMES_TTT_LOSE', 'Perdiste.');
    else if (isFull(safeBoard)) status = tr(safeLang, 'GAMES_TTT_DRAW', 'Empate.');
    else status = tr(safeLang, 'GAMES_TTT_TURN', 'Tu turno (❌)');

    container.addTextDisplayComponents(c => c.setContent(status));

    const lockBoard = Boolean(disabled) || w !== 0 || isFull(safeBoard);

    for (let r = 0; r < 3; r += 1) {
        container.addActionRowComponents(row => row.addComponents(
            buildCellButton({ userId: safeUserId, pos: (r * 3) + 0, board: safeBoard, packed, disabled: lockBoard }),
            buildCellButton({ userId: safeUserId, pos: (r * 3) + 1, board: safeBoard, packed, disabled: lockBoard }),
            buildCellButton({ userId: safeUserId, pos: (r * 3) + 2, board: safeBoard, packed, disabled: lockBoard }),
        ));
    }

    container.addActionRowComponents(r => r.addComponents(
        new ButtonBuilder()
            .setCustomId(`ttt:n:${safeUserId}`)
            .setEmoji('🔄')
            .setLabel(tr(safeLang, 'GAMES_TTT_NEW', 'Nueva'))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(Boolean(disabled)),
        new ButtonBuilder()
            .setCustomId(`ttt:close:${safeUserId}:${packed}`)
            .setEmoji('🗑️')
            .setLabel(tr(safeLang, 'GAMES_TTT_CLOSE', 'Cerrar'))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(Boolean(disabled)),
    ));

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function applyHumanMove({ packed, pos }) {
    const board = unpackBoard(packed);
    if (!Number.isInteger(pos) || pos < 0 || pos > 8) return { board, changed: false };
    if (board[pos] !== 0) return { board, changed: false };
    if (winner(board) !== 0 || isFull(board)) return { board, changed: false };

    board[pos] = 1;
    return { board, changed: true };
}

function applyBotMove(board) {
    if (winner(board) !== 0 || isFull(board)) return { board, changed: false };
    const pos = pickBotMove(board);
    if (pos < 0) return { board, changed: false };
    const next = board.slice();
    next[pos] = 2;
    return { board: next, changed: true };
}

module.exports = {
    tr,
    packBoard,
    unpackBoard,
    winner,
    parseTttCustomId,
    buildTttMessageOptions,
    applyHumanMove,
    applyBotMove,
};
