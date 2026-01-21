const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const Config = require('../Config');
const moxi = require('../i18n');

function tr(lang, key, vars) {
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
    return moxi.translate(`misc:${key}`, safeLang, vars);
}

function normalizeChoice(choice) {
    const c = String(choice || '').toLowerCase().trim();
    if (c === 'r' || c === 'rock' || c === 'piedra') return 'rock';
    if (c === 'p' || c === 'paper' || c === 'papel') return 'paper';
    if (c === 's' || c === 'scissors' || c === 'tijera' || c === 'tijeras') return 'scissors';
    return null;
}

function randomChoice() {
    return ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
}

function beats(a, b) {
    return (a === 'rock' && b === 'scissors')
        || (a === 'paper' && b === 'rock')
        || (a === 'scissors' && b === 'paper');
}

function emojiFor(choice) {
    if (choice === 'rock') return '🪨';
    if (choice === 'paper') return '📄';
    if (choice === 'scissors') return '✂️';
    return '❔';
}

function buildRpsMessageOptions({ userId, lang, resolved = null, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';

    const accent = Config?.Bot?.AccentColor || 0x5865F2;
    const container = new ContainerBuilder().setAccentColor(accent);

    container.addTextDisplayComponents(c => c.setContent(`## 🕹️ ${tr(safeLang, 'GAMES_RPS_TITLE') || 'Piedra, Papel o Tijera'}`));
    container.addSeparatorComponents(s => s.setDivider(true));

    if (!resolved) {
        container.addTextDisplayComponents(c => c.setContent(tr(safeLang, 'GAMES_RPS_PROMPT') || 'Elige una opción:'));
    } else {
        const { you, bot, outcome } = resolved;
        const line = tr(safeLang, 'GAMES_RPS_RESULT', {
            you: emojiFor(you),
            bot: emojiFor(bot),
            outcome,
        }) || `Tú: ${emojiFor(you)}  •  Bot: ${emojiFor(bot)}\n${outcome}`;
        container.addTextDisplayComponents(c => c.setContent(line));
    }

    container.addActionRowComponents(r => r.addComponents(
        new ButtonBuilder().setCustomId(`rps:pick:${safeUserId}:rock`).setEmoji('🪨').setLabel(tr(safeLang, 'GAMES_RPS_ROCK') || 'Piedra').setStyle(ButtonStyle.Secondary).setDisabled(disabled || Boolean(resolved)),
        new ButtonBuilder().setCustomId(`rps:pick:${safeUserId}:paper`).setEmoji('📄').setLabel(tr(safeLang, 'GAMES_RPS_PAPER') || 'Papel').setStyle(ButtonStyle.Secondary).setDisabled(disabled || Boolean(resolved)),
        new ButtonBuilder().setCustomId(`rps:pick:${safeUserId}:scissors`).setEmoji('✂️').setLabel(tr(safeLang, 'GAMES_RPS_SCISSORS') || 'Tijera').setStyle(ButtonStyle.Secondary).setDisabled(disabled || Boolean(resolved))
    ));

    container.addActionRowComponents(r => r.addComponents(
        new ButtonBuilder().setCustomId(`rps:new:${safeUserId}`).setEmoji('🔄').setLabel(tr(safeLang, 'GAMES_RPS_NEW') || 'Otra').setStyle(ButtonStyle.Primary).setDisabled(disabled)
    ));

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function resolveRps(youChoice) {
    const you = normalizeChoice(youChoice) || 'rock';
    const bot = randomChoice();

    let outcome;
    if (you === bot) outcome = 'Empate';
    else if (beats(you, bot)) outcome = 'Ganaste';
    else outcome = 'Perdiste';

    return { you, bot, outcome };
}

function parseRpsCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('rps:')) return null;
    const parts = raw.split(':');
    return { action: parts[1], userId: parts[2], choice: parts[3], parts };
}

module.exports = {
    tr,
    normalizeChoice,
    resolveRps,
    parseRpsCustomId,
    buildRpsMessageOptions,
};
