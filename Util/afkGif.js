const { getRandomNekosGif } = require('./nekosApi');

const AFK_GIF_URL = process.env.AFK_GIF_URL;
const AFK_FALLBACK_GIF_URL = process.env.AFK_FALLBACK_GIF_URL || 'https://media.tenor.com/3XKc1qDqD5kAAAAC/vaporwave-anime.gif';
const NEKOS_AFK_CATEGORIES = (process.env.NEKOS_AFK_CATEGORIES || 'sleep').split(',').map(c => c.trim()).filter(Boolean);

async function resolveAfkGif(overrideUrl) {
    if (overrideUrl) return overrideUrl;
    if (AFK_GIF_URL) return AFK_GIF_URL;
    const category = chooseCategory();
    const nekosGif = await getRandomNekosGif(category);
    return nekosGif || AFK_FALLBACK_GIF_URL;
}

function chooseCategory() {
    if (!NEKOS_AFK_CATEGORIES.length) return 'hug';
    if (NEKOS_AFK_CATEGORIES.length === 1) return NEKOS_AFK_CATEGORIES[0];
    const index = Math.floor(Math.random() * NEKOS_AFK_CATEGORIES.length);
    return NEKOS_AFK_CATEGORIES[index];
}

module.exports = {
    resolveAfkGif,
};
