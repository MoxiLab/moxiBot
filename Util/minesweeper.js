const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const Config = require('../Config');
const moxi = require('../i18n');
const { EMOJIS } = require('./emojis');

const DEFAULT_SIZE = 5;
const DEFAULT_MINES = 5;

function clampInt(value, min, max) {
    const v = Number.parseInt(String(value), 10);
    if (!Number.isFinite(v)) return null;
    return Math.max(min, Math.min(max, v));
}

function idxOf(x, y, size) {
    return (y * size) + x;
}

function bitGet(mask, bitIndex) {
    const b = BigInt(bitIndex);
    return (mask & (1n << b)) !== 0n;
}

function bitSet(mask, bitIndex) {
    const b = BigInt(bitIndex);
    return mask | (1n << b);
}

function bitClear(mask, bitIndex) {
    const b = BigInt(bitIndex);
    return mask & ~(1n << b);
}

function packState({ size, mineMask, revealMask, flagMask, status }) {
    const sz = clampInt(size, 2, 5) || DEFAULT_SIZE;
    const cells = sz * sz;
    const mm = BigInt(mineMask || 0);
    const rm = BigInt(revealMask || 0);
    const fm = BigInt(flagMask || 0);
    const st = BigInt(clampInt(status, 0, 3) || 0);

    // 25 bits per mask (size <= 5) => pack: mine | (reveal<<25) | (flag<<50) | (status<<75) | (size<<77)
    // size needs only 3 bits.
    const packed = (mm)
        | (rm << 25n)
        | (fm << 50n)
        | (st << 75n)
        | (BigInt(sz) << 77n);

    return packed.toString(36);
}

function unpackState(stateStr) {
    const packed = base36ToBigInt(stateStr);
    const size = Number((packed >> 77n) & 0x7n);
    const mineMask = packed & ((1n << 25n) - 1n);
    const revealMask = (packed >> 25n) & ((1n << 25n) - 1n);
    const flagMask = (packed >> 50n) & ((1n << 25n) - 1n);
    const status = Number((packed >> 75n) & 0x3n);

    const sz = clampInt(size, 2, 5) || DEFAULT_SIZE;
    const cells = sz * sz;

    // Mask off extra bits beyond cells for safety (when size < 5)
    const cellMask = (1n << BigInt(cells)) - 1n;
    return {
        size: sz,
        mineMask: mineMask & cellMask,
        revealMask: revealMask & cellMask,
        flagMask: flagMask & cellMask,
        status,
    };
}

function base36ToBigInt(str) {
    const s = String(str || '').trim().toLowerCase();
    if (!s) return 0n;
    let out = 0n;
    for (const ch of s) {
        const code = ch.charCodeAt(0);
        let v;
        if (code >= 48 && code <= 57) v = BigInt(code - 48);
        else if (code >= 97 && code <= 122) v = BigInt(code - 87);
        else continue;
        out = (out * 36n) + v;
    }
    return out;
}

function randomMineMask({ size, mines, safeIndex } = {}) {
    const sz = clampInt(size, 2, 5) || DEFAULT_SIZE;
    const cells = sz * sz;
    const m = clampInt(mines, 1, Math.max(1, cells - 1)) || DEFAULT_MINES;
    const safe = Number.isFinite(safeIndex) ? safeIndex : null;

    let mineMask = 0n;
    let placed = 0;
    let guard = 0;

    while (placed < m && guard < 5000) {
        guard++;
        const i = Math.floor(Math.random() * cells);
        if (safe !== null && i === safe) continue;
        if (bitGet(mineMask, i)) continue;
        mineMask = bitSet(mineMask, i);
        placed++;
    }

    return mineMask;
}

function countAdjacentMines({ x, y, size, mineMask }) {
    const sz = size;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= sz || ny >= sz) continue;
            if (bitGet(mineMask, idxOf(nx, ny, sz))) count++;
        }
    }
    return count;
}

function floodReveal({ x, y, state }) {
    const { size, mineMask } = state;
    const start = idxOf(x, y, size);
    const queue = [start];
    const seen = new Set([start]);

    let revealMask = BigInt(state.revealMask || 0);
    let status = Number(state.status || 0);

    while (queue.length) {
        const i = queue.shift();
        if (bitGet(revealMask, i)) continue;
        if (bitGet(mineMask, i)) {
            status = 1;
            revealMask = bitSet(revealMask, i);
            continue;
        }

        revealMask = bitSet(revealMask, i);

        const cx = i % size;
        const cy = Math.floor(i / size);
        const adj = countAdjacentMines({ x: cx, y: cy, size, mineMask });
        if (adj !== 0) continue;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
                const ni = idxOf(nx, ny, size);
                if (seen.has(ni)) continue;
                if (bitGet(mineMask, ni)) continue;
                seen.add(ni);
                queue.push(ni);
            }
        }
    }

    return { ...state, revealMask, status };
}

function checkWin(state) {
    const { size, mineMask, revealMask } = state;
    const cells = size * size;
    const cellMask = (1n << BigInt(cells)) - 1n;
    const safeMask = (~mineMask) & cellMask;
    return (revealMask & safeMask) === safeMask;
}

function revealAllMines(state) {
    return { ...state, revealMask: BigInt(state.revealMask || 0) | BigInt(state.mineMask || 0) };
}

function tr(lang, key, vars) {
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
    return moxi.translate(`misc:${key}`, safeLang, vars);
}

function buildMinesweeperMessageOptions({ userId, lang, state, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';

    const size = clampInt(state?.size, 2, 5) || DEFAULT_SIZE;
    const mineMask = BigInt(state?.mineMask || 0);
    const revealMask = BigInt(state?.revealMask || 0);
    const flagMask = BigInt(state?.flagMask || 0);
    const status = clampInt(state?.status, 0, 3) || 0;

    const title = tr(safeLang, 'GAMES_MINESWEEPER_TITLE') || 'Buscaminas';
    const helpLine = tr(safeLang, 'GAMES_MINESWEEPER_HELP') || 'Clic para abrir • Usa el modo 🚩 para marcar';

    const accent = Config?.Bot?.AccentColor || 0x5865F2;
    const container = new ContainerBuilder().setAccentColor(accent);

    const headerEmoji = status === 2 ? '🏆' : (status === 1 ? '💥' : '🧩');
    container.addTextDisplayComponents(c => c.setContent(`## ${headerEmoji} ${title}`));
    container.addSeparatorComponents(s => s.setDivider(true));

    let statusLine = '';
    if (status === 1) statusLine = tr(safeLang, 'GAMES_MINESWEEPER_LOST') || '¡Boom! Has perdido.';
    else if (status === 2) statusLine = tr(safeLang, 'GAMES_MINESWEEPER_WON') || '¡Ganaste!';
    else statusLine = tr(safeLang, 'GAMES_MINESWEEPER_PLAYING') || 'Partida en curso.';

    container.addTextDisplayComponents(c => c.setContent([`**${statusLine}**`, helpLine].join('\n')));

    const encoded = packState({ size, mineMask, revealMask, flagMask, status });

    const isLocked = disabled || status !== 0;
    const mode = String(state?.mode || 'open');
    const isFlagMode = mode === 'flag';

    // Grid: 5 rows max, 5 buttons per row
    for (let y = 0; y < size; y++) {
        container.addActionRowComponents((row) => {
            for (let x = 0; x < size; x++) {
                const i = idxOf(x, y, size);
                const isRevealed = bitGet(revealMask, i);
                const isMine = bitGet(mineMask, i);
                const isFlagged = bitGet(flagMask, i);

                const b = new ButtonBuilder();

                if (isRevealed) {
                    if (isMine) {
                        b.setEmoji('💣').setStyle(ButtonStyle.Danger).setCustomId('msw:noop');
                    } else {
                        const adj = countAdjacentMines({ x, y, size, mineMask });
                        if (adj === 0) {
                            b.setEmoji('⬛').setStyle(ButtonStyle.Secondary).setCustomId('msw:noop');
                        } else {
                            b.setLabel(String(adj)).setStyle(ButtonStyle.Secondary).setCustomId('msw:noop');
                        }
                    }
                    b.setDisabled(true);
                    row.addComponents(b);
                    continue;
                }

                // Hidden
                if (isFlagged) {
                    b.setEmoji('🚩').setStyle(ButtonStyle.Secondary);
                } else {
                    b.setEmoji('⬜').setStyle(ButtonStyle.Secondary);
                }

                // Click action depends on current mode.
                const act = isFlagMode ? 'g' : 'o';
                b.setCustomId(`msw:${act}:${safeUserId}:${x}:${y}:${encoded}`);
                b.setDisabled(isLocked);
                row.addComponents(b);
            }
            return row;
        });
    }

    // Controls
    container.addActionRowComponents(r => r.addComponents(
        new ButtonBuilder()
            .setCustomId(`msw:mode:${safeUserId}:${isFlagMode ? 'open' : 'flag'}:${encoded}`)
            .setEmoji(isFlagMode ? '🧩' : '🚩')
            .setLabel(isFlagMode
                ? (tr(safeLang, 'GAMES_MINESWEEPER_OPEN_MODE') || 'Abrir')
                : (tr(safeLang, 'GAMES_MINESWEEPER_FLAG_MODE') || 'Marcar'))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`msw:n:${safeUserId}`)
            .setEmoji(EMOJIS.refresh || '🔄')
            .setLabel(tr(safeLang, 'GAMES_MINESWEEPER_NEW') || 'Nueva')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`msw:close:${safeUserId}:${encoded}`)
            .setEmoji(EMOJIS.stopSign || '⛔')
            .setLabel(tr(safeLang, 'GAMES_MINESWEEPER_CLOSE') || 'Cerrar')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    ));

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function parseMinesweeperCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('msw:')) return null;
    const parts = raw.split(':');
    const action = parts[1];
    const userId = parts[2];
    return { raw, parts, action, userId };
}

// Public API
function newGameState({ size = DEFAULT_SIZE, mines = DEFAULT_MINES } = {}) {
    const sz = clampInt(size, 2, 5) || DEFAULT_SIZE;
    const cells = sz * sz;
    const m = clampInt(mines, 1, Math.max(1, cells - 1)) || DEFAULT_MINES;
    const mineMask = randomMineMask({ size: sz, mines: m, safeIndex: null });
    return {
        size: sz,
        mineMask,
        revealMask: 0n,
        flagMask: 0n,
        status: 0,
    };
}

function applyOpenCell({ state, x, y }) {
    const size = clampInt(state?.size, 2, 5) || DEFAULT_SIZE;
    const ix = clampInt(x, 0, size - 1);
    const iy = clampInt(y, 0, size - 1);
    if (ix === null || iy === null) return state;

    const i = idxOf(ix, iy, size);
    const mineMask = BigInt(state.mineMask || 0);
    const revealMask = BigInt(state.revealMask || 0);
    const flagMask = BigInt(state.flagMask || 0);

    if (bitGet(flagMask, i)) return state;
    if (bitGet(revealMask, i)) return state;

    // Ensure first click is safe: if no revealed cells yet and clicked a mine, regenerate with safeIndex
    const hasAnyReveal = revealMask !== 0n;
    if (!hasAnyReveal && bitGet(mineMask, i)) {
        const mines = DEFAULT_MINES;
        const mineMask2 = randomMineMask({ size, mines, safeIndex: i });
        const next = { ...state, mineMask: mineMask2 };
        const flooded = floodReveal({ x: ix, y: iy, state: next });
        const won = checkWin(flooded);
        return { ...flooded, status: won ? 2 : flooded.status };
    }

    if (bitGet(mineMask, i)) {
        const lost = revealAllMines({ ...state, revealMask: bitSet(revealMask, i), status: 1 });
        return lost;
    }

    const flooded = floodReveal({ x: ix, y: iy, state: { ...state, revealMask, flagMask } });
    const won = checkWin(flooded);
    return { ...flooded, status: won ? 2 : flooded.status };
}

function toggleFlagAt({ state, x, y }) {
    const size = clampInt(state?.size, 2, 5) || DEFAULT_SIZE;
    const ix = clampInt(x, 0, size - 1);
    const iy = clampInt(y, 0, size - 1);
    if (ix === null || iy === null) return state;

    const i = idxOf(ix, iy, size);
    const revealMask = BigInt(state.revealMask || 0);
    if (bitGet(revealMask, i)) return state;

    let flagMask = BigInt(state.flagMask || 0);
    if (bitGet(flagMask, i)) flagMask = bitClear(flagMask, i);
    else flagMask = bitSet(flagMask, i);
    return { ...state, flagMask };
}

module.exports = {
    DEFAULT_SIZE,
    DEFAULT_MINES,
    packState,
    unpackState,
    parseMinesweeperCustomId,
    newGameState,
    applyOpenCell,
    toggleFlagAt,
    buildMinesweeperMessageOptions,
    tr,
};
