const { Clvls, User } = require('../Models');
const { Bot } = require('../Config');
const debugHelper = require('./debugHelper');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

const CONFIG_TTL_MS = 2 * 60 * 1000;
const clvlsCache = new Map(); // guildId -> { expiresAt, doc }

function nowMs() {
    return Date.now();
}

function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function randomIntInclusive(min, max) {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    if (b < a) return a;
    return Math.floor(Math.random() * (b - a + 1)) + a;
}

function xpNeededForNextLevel(level) {
    const lvl = Math.max(1, Number(level) || 1);
    // Fórmula simple y estable (crece cuadrático):
    // lvl=1 -> 155, lvl=10 -> 1600 aprox
    return Math.floor(5 * (lvl ** 2) + 50 * lvl + 100);
}

async function getClvlsConfig(guildId) {
    const gid = normalizeDiscordId(guildId);
    if (!gid) return null;

    const cached = clvlsCache.get(gid);
    const now = nowMs();
    if (cached && cached.expiresAt > now) return cached.doc;

    // Upsert para asegurar doc con defaults.
    const doc = await Clvls.findOneAndUpdate(
        { guildID: gid },
        { $setOnInsert: { guildID: gid } },
        { upsert: true, new: true }
    ).lean().catch(() => null);

    clvlsCache.set(gid, { expiresAt: now + CONFIG_TTL_MS, doc });
    return doc;
}

function isChannelAllowed(channelId, cfg) {
    const ch = normalizeDiscordId(channelId);
    const allowed = Array.isArray(cfg?.allowedChannels) ? cfg.allowedChannels.map((id) => normalizeDiscordId(id)).filter(Boolean) : [];
    const blocked = Array.isArray(cfg?.blockedChannels) ? cfg.blockedChannels.map((id) => normalizeDiscordId(id)).filter(Boolean) : [];

    if (allowed.length > 0) {
        return allowed.includes(ch);
    }
    if (blocked.length > 0) {
        return !blocked.includes(ch);
    }
    return true;
}

function computeMultiplier(member, channelId, cfg) {
    let mult = 1;

    const byChannel = Array.isArray(cfg?.multipliers?.byChannel) ? cfg.multipliers.byChannel : [];
    const byRole = Array.isArray(cfg?.multipliers?.byRole) ? cfg.multipliers.byRole : [];

    const ch = String(channelId || '');
    const chRule = byChannel.find(r => String(r?.channelID || '') === ch);
    if (chRule && typeof chRule.multiplier === 'number' && Number.isFinite(chRule.multiplier)) {
        mult *= Math.max(0, chRule.multiplier);
    }

    if (member?.roles?.cache && byRole.length) {
        for (const roleRule of byRole) {
            const rid = String(roleRule?.roleID || '');
            if(rid && member.roles.cache.has(rid)) {
                if (typeof roleRule.multiplier === 'number' && Number.isFinite(roleRule.multiplier)) {
                    mult *= Math.max(0, roleRule.multiplier);
                }
            }
        }
    }

    return mult;
}

function applyLevelUpTemplate(template, { userMention, level }) {
    const raw = (template === undefined || template === null) ? '' : String(template);
    return raw
        .replace(/\{user\}/g, userMention)
        .replace(/\{level\}/g, String(level));
}

function toHexColor(color, fallback = '#ffb6e6') {
    if (typeof color === 'number' && Number.isFinite(color)) {
        return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
    }

    const raw = String(color || '').trim();
    if (!raw) return fallback;

    if (raw.startsWith('#') && raw.length === 7) return raw.toLowerCase();
    if (raw.startsWith('0x')) return `#${raw.slice(2).padStart(6, '0').toLowerCase()}`;

    const hex = raw.startsWith('#') ? raw.slice(1) : raw;
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;

    return fallback;
}

async function getUserBannerUrl(client, userId) {
    if (!client?.users?.fetch) return null;
    const fetched = await client.users.fetch(userId, { force: true }).catch(() => null);
    return fetched?.bannerURL?.({ size: 2048, extension: 'png' })
        || fetched?.bannerURL?.({ size: 2048, extension: 'jpg' })
        || null;
}

async function sendLevelUpNotification({ message, cfg, newLevel }) {
    if (!cfg?.levelUpNotifications?.enabled) return;

    const targetChannelId = normalizeDiscordId(cfg?.levelUpNotifications?.channel)
        || normalizeDiscordId(message?.channel?.id);
    if (!targetChannelId) return;

    const channel = message.guild.channels.cache.get(targetChannelId)
        || await message.guild.channels.fetch(targetChannelId).catch(() => null);

    if (!channel) return;
    if (typeof channel.isTextBased === 'function' && !channel.isTextBased()) return;
    if (typeof channel.send !== 'function') return;

    const me = message.guild.members.me || await message.guild.members.fetch(message.client.user.id).catch(() => null);
    const perms = me ? channel.permissionsFor?.(me) : null;
    if (!perms || !perms.has(['ViewChannel', 'SendMessages'])) return;

    const tpl = cfg?.levelUpNotifications?.message;
    const content = applyLevelUpTemplate(tpl, { userMention: `<@${message.author.id}>`, level: newLevel });

    // Card (canvafy LevelUp). Siempre que esté enabled. Best-effort + fallback a texto.
    try {
        const { AttachmentBuilder } = require('discord.js');
        const { LevelUp } = require('canvafy');
        const accentHex = toHexColor(Bot?.AccentColor);

        const bannerUrl = await getUserBannerUrl(message.client, message.author.id);

        const avatar = typeof message.author?.displayAvatarURL === 'function'
            ? message.author.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true })
            : null;

        const prev = Math.max(1, Number(newLevel || 1) - 1);
        const next = Math.max(1, Number(newLevel || 1));

        const card = await new LevelUp()
            .setAvatar(avatar || 'https://cdn.discordapp.com/embed/avatars/0.png')
            .setBackground(bannerUrl ? 'image' : 'color', bannerUrl || '#23272a')
            .setUsername(String(message.author?.username || 'User'))
            .setBorder(accentHex)
            .setAvatarBorder(accentHex)
            .setOverlayOpacity(0.7)
            .setLevels(prev, next)
            .build();

        const attachment = new AttachmentBuilder(card, { name: 'levelup.png' });
        await channel.send({ content: content || '', files: [attachment] }).catch(() => null);
        return;
    } catch (e) {
        // fallback a texto
        if (!content) return;
        await channel.send({ content }).catch(() => null);
    }
}

async function awardXpForMessage(message) {
    if (!message?.guild?.id) return;
    if (!message?.author?.id) return;
    if (message.author.bot) return;

    const levelsDebugEnabled = debugHelper.isEnabled('levels');

    const guildId = normalizeDiscordId(message.guild.id);
    const userId = normalizeDiscordId(message.author.id);
    const channelId = normalizeDiscordId(message.channel.id);
    if (!guildId || !userId || !channelId) return;
    const cfg = await getClvlsConfig(guildId);
    if (!cfg) return;

    if (!isChannelAllowed(channelId, cfg)) {
        if (levelsDebugEnabled) debugHelper.log('levels', 'channel not allowed', { guildId, channelId });
        return;
    }

    const content = String(message.content || '').trim();
    const minChars = clampNumber(cfg?.minCharactersForXp, 0, 5000, 10);
    if (minChars > 0 && content.length < minChars) return;

    const cooldownSec = clampNumber(cfg?.xpCooldown, 0, 24 * 60 * 60, 60);
    const now = nowMs();

    // Obtener/crear usuario
    let userDoc = await User.findOne({ guildID: guildId, userID: userId }).catch(() => null);
    if (!userDoc) {
        userDoc = await User.create({
            guildID: guildId,
            userID: userId,
            username: normalizeDbText(message.author.username, { maxLen: 64, fallback: 'User' }),
        }).catch(() => null);
    }
    if (!userDoc) return;

    const last = userDoc.lastXpGain ? new Date(userDoc.lastXpGain).getTime() : 0;
    if (cooldownSec > 0 && last && (now - last) < (cooldownSec * 1000)) {
        return;
    }

    const minXp = clampNumber(cfg?.minXpPerMessage, 0, 100000, 5);
    const maxXp = clampNumber(cfg?.maxXpPerMessage, minXp, 100000, 25);
    let gained = randomIntInclusive(minXp, maxXp);

    const mult = computeMultiplier(message.member, channelId, cfg);
    gained = Math.floor(gained * mult);
    if (gained <= 0) {
        // Aun así actualizar cooldown para evitar spam si hay multiplicador 0.
        userDoc.lastXpGain = new Date(now);
        userDoc.updatedAt = new Date(now);
        await userDoc.save().catch(() => null);
        return;
    }

    const beforeLevel = userDoc.level || 1;

    userDoc.username = normalizeDbText(message.author.username, { maxLen: 64, fallback: 'User' });
    userDoc.xp = (userDoc.xp || 0) + gained;
    userDoc.totalXp = (userDoc.totalXp || 0) + gained;
    userDoc.lastXpGain = new Date(now);
    userDoc.updatedAt = new Date(now);
    userDoc.stats = userDoc.stats || {};
    userDoc.stats.messagesCount = (userDoc.stats.messagesCount || 0) + 1;

    let leveledUp = false;
    while (userDoc.xp >= xpNeededForNextLevel(userDoc.level)) {
        userDoc.xp -= xpNeededForNextLevel(userDoc.level);
        userDoc.level = (userDoc.level || 1) + 1;
        leveledUp = true;
        userDoc.stats.levelUps = (userDoc.stats.levelUps || 0) + 1;
    }

    await userDoc.save().catch(() => null);

    // Nivel global (acumula entre todos los servidores, estilo Nekotina)
    awardGlobalXp(userId).catch(() => null);

    if (levelsDebugEnabled) {
        debugHelper.log('levels', 'xp gain', {
            guildId,
            userId,
            gained,
            mult,
            level: userDoc.level,
            beforeLevel,
            xp: userDoc.xp,
            totalXp: userDoc.totalXp,
        });
    }

    if (leveledUp) {
        await sendLevelUpNotification({ message, cfg, newLevel: userDoc.level });
    }
}

const GLOBAL_XP_COOLDOWN_SEC = 60;
const GLOBAL_XP_MIN = 15;
const GLOBAL_XP_MAX = 40;

async function awardGlobalXp(userId) {
    const uid = normalizeDiscordId(userId);
    if (!uid) return;

    const { Economy } = require('../Models/EconomySchema');
    const now = nowMs();

    const eco = await Economy.findOne({ userId: uid }).catch(() => null);
    if (!eco) return;

    const lastGain = eco.lastGlobalXpGain ? new Date(eco.lastGlobalXpGain).getTime() : 0;
    if (lastGain && (now - lastGain) < (GLOBAL_XP_COOLDOWN_SEC * 1000)) return;

    const gained = randomIntInclusive(GLOBAL_XP_MIN, GLOBAL_XP_MAX);

    eco.globalXp = (eco.globalXp || 0) + gained;
    eco.globalTotalXp = (eco.globalTotalXp || 0) + gained;
    eco.lastGlobalXpGain = new Date(now);

    while (eco.globalXp >= xpNeededForNextLevel(eco.globalLevel || 1)) {
        eco.globalXp -= xpNeededForNextLevel(eco.globalLevel || 1);
        eco.globalLevel = (eco.globalLevel || 1) + 1;
    }

    await eco.save().catch(() => null);
}

module.exports = {
    getClvlsConfig,
    awardXpForMessage,
    awardGlobalXp,
    xpNeededForNextLevel,
};
