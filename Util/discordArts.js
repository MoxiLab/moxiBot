let discordArts;
try {
    discordArts = require('discord-arts');
} catch (_) {
    discordArts = null;
}

async function buildDiscordArtsProfile({ userId, customTag, customSubtitle, customBackground }) {
    if (!discordArts || typeof discordArts.Profile !== 'function') {
        throw new Error('discord-arts no está instalado o no exporta Profile()');
    }

    const options = {};
    if (typeof customTag === 'string' && customTag.trim()) options.customTag = customTag;
    if (typeof customSubtitle === 'string' && customSubtitle.trim()) options.customSubtitle = customSubtitle;
    if (typeof customBackground === 'string' && customBackground.trim()) options.customBackground = customBackground;

    return await discordArts.Profile(String(userId), options);
}

module.exports = { buildDiscordArtsProfile };
