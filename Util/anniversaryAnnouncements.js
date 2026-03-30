const { ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const User = require('../Models/UserSchema');
const AnniversaryAnnouncement = require('../Models/AnniversaryAnnouncementSchema');
const BirthdayGuildConfig = require('../Models/BirthdayGuildConfigSchema');
const { Bot } = require('../Config');
const logger = require('./logger');

function getDatePartsInTimezone(timezone) {
    try {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
        const parts = formatter.formatToParts(new Date());
        const map = {};
        for (const p of parts) {
            if (p && p.type && p.value) map[p.type] = p.value;
        }

        const day = Number(map.day || 0);
        const month = Number(map.month || 0);
        const year = Number(map.year || 0);
        const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        return { day, month, year, dateKey };
    } catch {
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { day, month, year, dateKey };
    }
}

function getYearsFromAnniversary(anniversaryDateLike, now = new Date()) {
    if (!anniversaryDateLike) return 0;
    const ann = anniversaryDateLike instanceof Date ? anniversaryDateLike : new Date(anniversaryDateLike);
    if (Number.isNaN(ann.getTime())) return 0;

    let years = now.getFullYear() - ann.getFullYear();
    if (years <= 0) return 0;

    const annThisYear = new Date(ann);
    annThisYear.setFullYear(now.getFullYear());
    if (annThisYear > now) years -= 1;

    return Math.max(0, years);
}

function normalizePair(a, b) {
    const x = String(a || '').trim();
    const y = String(b || '').trim();
    if (!x || !y) return null;
    return x < y ? { userA: x, userB: y, pairKey: `${x}:${y}` } : { userA: y, userB: x, pairKey: `${y}:${x}` };
}

async function getMe(guild) {
    try {
        if (guild.members?.me) return guild.members.me;
        if (typeof guild.members?.fetchMe === 'function') {
            return await guild.members.fetchMe();
        }
    } catch {
        // ignore
    }
    return null;
}

function canSendInChannel(channel, me) {
    if (!channel || !channel.isTextBased?.() || channel.isDMBased?.()) return false;
    if (!me) return false;
    try {
        const perms = channel.permissionsFor(me);
        if (!perms) return false;
        return perms.has(PermissionsBitField.Flags.ViewChannel)
            && perms.has(PermissionsBitField.Flags.SendMessages);
    } catch {
        return false;
    }
}

async function pickAnnouncementChannel(guild) {
    const me = await getMe(guild);
    if (!me) return null;

    try {
        const cfg = await BirthdayGuildConfig.findOne({ guildID: String(guild.id) }).lean();
        const configuredId = cfg?.channelID ? String(cfg.channelID) : null;
        if (configuredId) {
            const configuredChannel = await guild.channels.fetch(configuredId).catch(() => null);
            if (canSendInChannel(configuredChannel, me)) return configuredChannel;
        }
    } catch {
        // ignore and fallback
    }

    const system = guild.systemChannel;
    if (canSendInChannel(system, me)) return system;

    const preferredTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
    const channels = guild.channels?.cache
        ? [...guild.channels.cache.values()]
        : [];

    const candidate = channels
        .filter((ch) => preferredTypes.includes(ch.type))
        .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
        .find((ch) => canSendInChannel(ch, me));

    return candidate || null;
}

async function announceAnniversariesForGuild(client, guild, dateInfo) {
    const guildId = String(guild.id);

    const guildUsers = await User.find(
        { guildID: guildId },
        { userID: 1 }
    ).lean().catch(() => []);

    const memberIds = new Set(
        (Array.isArray(guildUsers) ? guildUsers : [])
            .map((x) => String(x?.userID || ''))
            .filter(Boolean)
    );

    if (!memberIds.size) return { announced: 0, skipped: 0 };

    const rows = await User.find(
        {
            guildID: 'GLOBAL',
            userID: { $in: [...memberIds] },
            'marriage.anniversaryDate': { $ne: null },
            'marriage.spouse': { $in: [...memberIds] },
        },
        {
            userID: 1,
            marriage: 1,
        }
    ).lean().catch(() => []);

    const pairMap = new Map();
    const now = new Date();

    for (const doc of Array.isArray(rows) ? rows : []) {
        const userId = String(doc?.userID || '');
        const spouseId = String(doc?.marriage?.spouse || '');
        const annDate = doc?.marriage?.anniversaryDate;

        const pair = normalizePair(userId, spouseId);
        if (!pair) continue;

        const d = annDate ? new Date(annDate) : null;
        if (!d || Number.isNaN(d.getTime())) continue;
        if (d.getDate() !== dateInfo.day || (d.getMonth() + 1) !== dateInfo.month) continue;

        const years = getYearsFromAnniversary(d, now);
        if (years <= 0) continue;

        if (!pairMap.has(pair.pairKey)) {
            pairMap.set(pair.pairKey, {
                ...pair,
                years,
            });
        }
    }

    const pairs = [...pairMap.values()];
    if (!pairs.length) return { announced: 0, skipped: 0 };

    const channel = await pickAnnouncementChannel(guild);
    if (!channel) return { announced: 0, skipped: pairs.length };

    const toAnnounce = [];
    for (const pair of pairs) {
        const res = await AnniversaryAnnouncement.updateOne(
            {
                guildID: guildId,
                pairKey: pair.pairKey,
                dateKey: dateInfo.dateKey,
            },
            {
                $setOnInsert: {
                    guildID: guildId,
                    pairKey: pair.pairKey,
                    userA: pair.userA,
                    userB: pair.userB,
                    years: pair.years,
                    dateKey: dateInfo.dateKey,
                    channelID: String(channel.id),
                    announcedAt: new Date(),
                },
            },
            { upsert: true }
        ).catch(() => null);

        if (res && res.upsertedId) toAnnounce.push(pair);
    }

    if (!toAnnounce.length) return { announced: 0, skipped: pairs.length };

    const lines = toAnnounce.map((p) => `> 💞 <@${p.userA}> y <@${p.userB}> — ${p.years} año(s) juntos`);

    const embed = new EmbedBuilder()
        .setColor(Bot?.AccentColor || 0xFFB6E6)
        .setDescription('💍 ¡Feliz aniversario a nuestras parejas de hoy!')
        .setFooter({ text: `${guild.name} • Amor y celebración` })
        .setTimestamp(new Date());

    const mentionUsers = [...new Set(toAnnounce.flatMap((p) => [p.userA, p.userB]))];

    await channel.send({
        content: ['🎉 **¡Aniversarios de hoy!**', '', ...lines].join('\n'),
        embeds: [embed],
        allowedMentions: { users: mentionUsers },
    });

    return {
        announced: toAnnounce.length,
        skipped: Math.max(0, pairs.length - toAnnounce.length),
    };
}

async function runAnniversaryAnnouncements(client, timezone) {
    if (!client?.isReady?.()) return;

    const dateInfo = getDatePartsInTimezone(timezone);
    let totalAnnounced = 0;

    for (const guild of client.guilds.cache.values()) {
        try {
            const result = await announceAnniversariesForGuild(client, guild, dateInfo);
            totalAnnounced += Number(result?.announced || 0);
        } catch {
            // ignore guild-level errors so one guild does not stop the cycle
        }
    }

    if (totalAnnounced > 0) {
        logger.info(`[anniversary] Anuncios enviados: ${totalAnnounced} (${dateInfo.dateKey})`);
    }
}

function startAnniversaryAnnouncements(client, { timezone = 'Europe/Madrid', intervalMs = 30 * 60 * 1000 } = {}) {
    if (!client) return;

    if (client.__anniversaryAnnouncementInterval) {
        try { clearInterval(client.__anniversaryAnnouncementInterval); } catch { }
    }

    client.__anniversaryAnnouncementRunning = false;

    const tick = async () => {
        if (client.__anniversaryAnnouncementRunning) return;
        client.__anniversaryAnnouncementRunning = true;
        try {
            await runAnniversaryAnnouncements(client, timezone);
        } finally {
            client.__anniversaryAnnouncementRunning = false;
        }
    };

    tick().catch(() => null);
    client.__anniversaryAnnouncementInterval = setInterval(() => {
        tick().catch(() => null);
    }, Math.max(120_000, Number(intervalMs) || 30 * 60 * 1000));

    try {
        client.__anniversaryAnnouncementInterval.unref?.();
    } catch {
        // ignore
    }
}

module.exports = {
    startAnniversaryAnnouncements,
};
