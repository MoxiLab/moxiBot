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
    discriminator,
    avatarUrl,
    avatarDecorationAsset,
    flags,
    isBot,
    createdTimestamp,
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

        const lvl = Math.max(1, Number(level) || 1);
        const cur = Math.max(0, Number(currentXp) || 0);
        const req = Math.max(1, Number(requiredXp) || 1);
        const rnk = Math.max(0, Number(rank) || 0);
        const pres = Math.max(0, Number(prestige) || 0);

        // canvacard v6: setAvatar(url, decorationAsset, overlay)
        if (avatarUrl && typeof card.setAvatar === 'function') {
            try {
                card.setAvatar(String(avatarUrl), avatarDecorationAsset || null, false);
            } catch (_) {
                try { card.setAvatar(String(avatarUrl)); } catch (_) { }
            }
        }

        // canvacard v6: setUsername(username, discriminator, color)
        if (username && typeof card.setUsername === 'function') {
            try {
                card.setUsername(String(username), discriminator ? String(discriminator) : null, '#FFFFFF');
            } catch (_) {
                try { card.setUsername(String(username)); } catch (_) { }
            }
        }

        // canvacard v6: setBadges(flags, bot, display)
        if (typeof card.setBadges === 'function') {
            try {
                card.setBadges(flags ?? 0, !!isBot, true);
            } catch (_) { }
        }

        // canvacard v6: setBorder([color1, color2], direction)
        if (typeof card.setBorder === 'function') {
            try {
                card.setBorder(['#22274a', '#001eff'], 'vertical');
            } catch (_) { }
        }

        // canvacard v6: setBanner(url, blur)
        if (backgroundUrl) {
            if (typeof card.setBanner === 'function') {
                try {
                    card.setBanner(String(backgroundUrl), true);
                } catch (_) {
                    try { card.setBanner(String(backgroundUrl)); } catch (_) { }
                }
            } else if (typeof card.setBackground === 'function') {
                try {
                    card.setBackground('IMAGE', String(backgroundUrl));
                } catch (_) {
                    try { card.setBackground('image', String(backgroundUrl)); } catch (_) { }
                }
            } else if (typeof card.setBackgroundImage === 'function') {
                try { card.setBackgroundImage(String(backgroundUrl)); } catch (_) { }
            }
        } else if (typeof card.setBackground === 'function') {
            try {
                card.setBackground('COLOR', '#23272A');
            } catch (_) {
                try { card.setBackground('color', '#23272A'); } catch (_) { }
            }
        }

        if (typeof card.setCurrentXP === 'function') card.setCurrentXP(cur);
        if (typeof card.setCurrentXp === 'function') card.setCurrentXp(cur);
        if (typeof card.setRequiredXP === 'function') card.setRequiredXP(req);
        if (typeof card.setRequiredXp === 'function') card.setRequiredXp(req);

        if (typeof card.setRank === 'function') {
            try {
                card.setRank(rnk || 0, 'RANK', true);
            } catch (_) {
                try { card.setRank(rnk || 0); } catch (_) { }
            }
        }

        if (typeof card.setLevel === 'function') {
            try {
                card.setLevel(lvl, 'LEVEL');
            } catch (_) {
                try { card.setLevel(lvl); } catch (_) { }
            }
        }

        if (typeof card.setPrestige === 'function') {
            try { card.setPrestige(pres); } catch (_) { }
        }

        if (typeof card.setStatus === 'function') {
            try { card.setStatus('online'); } catch (_) { }
        }

        // canvacard v6: setProgressBar([color1,color2], type, rounded)
        if (typeof card.setProgressBar === 'function') {
            try {
                card.setProgressBar(['#14C49E', '#FF0000'], 'GRADIENT', true);
            } catch (_) { }
        }

        if (createdTimestamp && typeof card.setCreatedTimestamp === 'function') {
            try { card.setCreatedTimestamp(Number(createdTimestamp)); } catch (_) { }
        }

        // canvacard.build(fontName)
        if (typeof card.build === 'function') {
            try {
                return await card.build('Cascadia Code PL, Noto Color Emoji, Arial');
            } catch (_) {
                return await card.build();
            }
        }
        if (typeof card.render === 'function') return await card.render();
        return null;
    } catch (err) {
        throw err;
    }
}

module.exports = { buildCanvacardWelcomeLeave, buildCanvacardRank };
