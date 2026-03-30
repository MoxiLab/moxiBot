let canvafy;
try {
    canvafy = require('canvafy');
} catch (_) {
    canvafy = null;
}

const { xpNeededForNextLevel } = require('../../Util/levels');
const { buildDiscordArtsProfile } = require('../../Util/discordArts');
const { buildCanvacardRank } = require('../../Util/canvacard');
const { RankCard } = require('rankcard');

function pickCtor() {
    if (!canvafy) return null;
    // Distintas versiones/export pueden variar
    return canvafy.Rank || canvafy.RankCard || canvafy.rank || null;
}

async function generateRankImage(user, levelInfo, styleOrOpts) {
    const Ctor = pickCtor();
    const opts = (styleOrOpts && typeof styleOrOpts === 'object') ? styleOrOpts : {};
    const style = typeof styleOrOpts === 'string'
        ? styleOrOpts
        : (typeof opts.style === 'string' ? opts.style : 'sylphacard');
    const backgroundUrl = typeof opts.backgroundUrl === 'string' ? opts.backgroundUrl : undefined;

    // Datos
    const username = user?.username ? String(user.username) : 'User';
    const discriminator = (user && typeof user.discriminator === 'string' && user.discriminator !== '0')
        ? user.discriminator
        : null;
    const avatar = typeof user?.displayAvatarURL === 'function'
        ? user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true })
        : null;

    // Avatar decoration (best-effort; depende de la versión de discord.js)
    const avatarDecorationAsset = user?.avatarDecorationData?.asset
        || user?.avatar_decoration_data?.asset
        || null;

    const flags = user?.flags?.bitfield ?? user?.publicFlags?.bitfield ?? null;
    const isBot = !!user?.bot;
    const createdTimestamp = user?.createdTimestamp || null;

    const level = Number(levelInfo?.level || 1);
    const prestige = Number(levelInfo?.prestige || 0);
    const currentXp = Number(levelInfo?.currentXp || 0);
    const totalXp = Number(levelInfo?.totalXp || 0);
    const rank = Number(levelInfo?.rank || 0);
    const requiredXp = Math.max(1, xpNeededForNextLevel(level));

    const progress = Math.max(0, Math.min(100, Math.round((currentXp / requiredXp) * 100)));

    async function tryDiscordArts() {
        try {
            const tag = `Nivel ${level}${prestige ? ` • Prestige ${prestige}` : ''}`;
            const subtitle = `XP ${currentXp}/${requiredXp}${rank ? ` • #${rank}` : ''}`;
            return await buildDiscordArtsProfile({
                userId: user?.id,
                customTag: tag,
                customSubtitle: subtitle,
                customBackground: backgroundUrl,
            });
        } catch (_) {
            return null;
        }
    }

    async function tryRankCard() {
        if (!RankCard) return null;
        try {
            return await RankCard({
                name: username,
                avatar: avatar || undefined,
                level: `${level}`,
                rank: `${rank}`,
                color: opts.color || 'auto',
                brightness: opts.brightness ?? 50,
                shape: 'circle',
                status: 'online',
                progress,
                requiredXp: `${requiredXp}`,
                currentXp: `${currentXp}`,
                showXp: true,
                customBackground: backgroundUrl
            });
        } catch (_) {
            return null;
        }
    }

    async function tryCanvacard() {
        try {
            return await buildCanvacardRank({
                username,
                discriminator,
                avatarUrl: avatar,
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
            });
        } catch (_) {
            return null;
        }
    }

    // Estilo canvacard
    if (style === 'canvacard') {
        const buf = await tryCanvacard();
        if (buf) return buf;
    }

    if (style === 'discord-arts') {
        const buf = await tryDiscordArts();
        if (buf) return buf;
    }

    if (style === 'rankcard') {
        // Preferimos canvacard (más control + ya es dependency del proyecto).
        const buf = await tryCanvacard();
        if (buf) return buf;
        const fallback = await tryRankCard();
        if (fallback) return fallback;
    }

    // Estilo por defecto (sylphacard): mantenemos el rank card actual (canvafy) por estabilidad.
    if (!Ctor) {
        return (await tryRankCard()) || (await tryDiscordArts()) || (await tryCanvacard());
    }

    // Construcción defensiva: si el API no encaja, devolvemos null.
    try {
        const card = new Ctor();

        if (avatar && typeof card.setAvatar === 'function') card.setAvatar(avatar);
        if (typeof card.setUsername === 'function') card.setUsername(username);

        // Muchos Rank cards usan setLevel/setCurrentXP/setRequiredXP. Usamos lo que exista.
        if (typeof card.setLevel === 'function') card.setLevel(level);
        if (typeof card.setPrestige === 'function') card.setPrestige(prestige);

        if (typeof card.setCurrentXp === 'function') card.setCurrentXp(currentXp);
        if (typeof card.setCurrentXP === 'function') card.setCurrentXP(currentXp);

        if (typeof card.setRequiredXp === 'function') card.setRequiredXp(requiredXp);
        if (typeof card.setRequiredXP === 'function') card.setRequiredXP(requiredXp);

        if (typeof card.setTotalXp === 'function') card.setTotalXp(totalXp);

        // Colores básicos
        if (typeof card.setBackground === 'function') card.setBackground('COLOR', '#23272A');

        if (typeof card.build === 'function') {
            return await card.build();
        }

        // Algunas versiones usan .render()
        if (typeof card.render === 'function') {
            return await card.render();
        }

        return (await tryRankCard()) || (await tryDiscordArts()) || (await tryCanvacard());
    } catch (_) {
        return (await tryRankCard()) || (await tryDiscordArts()) || (await tryCanvacard());
    }
}

module.exports = {
    generateRankImage,
};
