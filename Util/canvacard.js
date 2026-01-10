let canvacard;
try {
    canvacard = require('canvacard');
} catch (_) {
    canvacard = null;
}

function pickRankCtor() {
    if (!canvacard) return null;
    return canvacard.Rank || canvacard.RankCard || canvacard.rank || null;
}

async function buildCanvacardWelcomeLeave({
    type = 'welcome',
    avatarUrl,
    backgroundUrl,
    title,
    subtitle,
}) {
    if (!canvacard || typeof canvacard.WelcomeLeave !== 'function') {
        throw new Error('canvacard no está instalado o no exporta WelcomeLeave()');
    }

    const card = new canvacard.WelcomeLeave()
        .setAvatar(String(avatarUrl || ''));

    if (backgroundUrl) {
        card.setBackground('IMAGE', String(backgroundUrl));
    } else {
        card.setBackground('COLOR', '#000000');
    }

    if (title) card.setTitulo(String(title), '#FFFFFF');
    if (subtitle) card.setSubtitulo(String(subtitle), '#FFFFFF');

    card
        .setOpacityOverlay(1)
        .setColorCircle('#FFFFFF')
        .setColorOverlay('#5865F2')
        .setTypeOverlay('ROUNDED');

    // Algunas versiones exponen setType / setTypeCard, otras no.
    // Si existe, lo usamos para diferenciar welcome/leave.
    try {
        if (type && typeof card.setType === 'function') card.setType(type);
    } catch (_) { }

    // Fuente fallback común (la lib acepta cadena con múltiples fuentes)
    return await card.build('Cascadia Code PL, Noto Color Emoji, Arial');
}

async function buildCanvacardRank({
    username,
    avatarUrl,
    level,
    prestige,
    currentXp,
    requiredXp,
    rank,
    backgroundUrl,
}) {
    const Ctor = pickRankCtor();
    if (!Ctor) {
        throw new Error('canvacard no está instalado o no exporta Rank/RankCard()');
    }

    try {
        const card = new Ctor();

        if (avatarUrl && typeof card.setAvatar === 'function') card.setAvatar(String(avatarUrl));
        if (username && typeof card.setUsername === 'function') card.setUsername(String(username));

        const lvl = Math.max(1, Number(level) || 1);
        const cur = Math.max(0, Number(currentXp) || 0);
        const req = Math.max(1, Number(requiredXp) || 1);
        const rnk = Math.max(0, Number(rank) || 0);
        const pres = Math.max(0, Number(prestige) || 0);

        if (typeof card.setLevel === 'function') card.setLevel(lvl);
        if (typeof card.setPrestige === 'function') card.setPrestige(pres);

        if (typeof card.setCurrentXP === 'function') card.setCurrentXP(cur);
        if (typeof card.setCurrentXp === 'function') card.setCurrentXp(cur);
        if (typeof card.setRequiredXP === 'function') card.setRequiredXP(req);
        if (typeof card.setRequiredXp === 'function') card.setRequiredXp(req);

        if (rnk && typeof card.setRank === 'function') card.setRank(rnk);

        if (backgroundUrl) {
            if (typeof card.setBackground === 'function') {
                // Muchas versiones aceptan ('IMAGE', url) o ('image', url)
                try {
                    card.setBackground('IMAGE', String(backgroundUrl));
                } catch (_) {
                    try { card.setBackground('image', String(backgroundUrl)); } catch (_) { }
                }
            }
            if (typeof card.setBackgroundImage === 'function') {
                try { card.setBackgroundImage(String(backgroundUrl)); } catch (_) { }
            }
        } else if (typeof card.setBackground === 'function') {
            try {
                card.setBackground('COLOR', '#23272A');
            } catch (_) {
                try { card.setBackground('color', '#23272A'); } catch (_) { }
            }
        }

        if (typeof card.build === 'function') return await card.build();
        if (typeof card.render === 'function') return await card.render();
        return null;
    } catch (err) {
        throw err;
    }
}

module.exports = { buildCanvacardWelcomeLeave, buildCanvacardRank };
