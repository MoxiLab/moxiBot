const { ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const User = require('../Models/UserSchema');
const BirthdayAnnouncement = require('../Models/BirthdayAnnouncementSchema');
const BirthdayGuildConfig = require('../Models/BirthdayGuildConfigSchema');
const logger = require('./logger');
const { Bot } = require('../Config');
const { pickBirthdayGif } = require('./birthdayGifs');

function pickBirthdayBanner() {
    return pickBirthdayGif();
}

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

function getDateKeyForTimezone(timezone) {
    return getDatePartsInTimezone(timezone).dateKey;
}

function isAllowedInGuild(doc, guildId) {
    const blocked = doc?.profile?.birthdayConfig?.blockedGuilds;
    if (!Array.isArray(blocked)) return true;
    return !blocked.map((x) => String(x)).includes(String(guildId));
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

    // Prioriza el canal configurado manualmente para cumpleaños.
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

async function pickAnnouncementChannelDetailed(guild) {
    const me = await getMe(guild);
    if (!me) {
        return { channel: null, source: null, reason: 'bot-member-unavailable' };
    }

    try {
        const cfg = await BirthdayGuildConfig.findOne({ guildID: String(guild.id) }).lean();
        const configuredId = cfg?.channelID ? String(cfg.channelID) : null;
        if (configuredId) {
            const configuredChannel = await guild.channels.fetch(configuredId).catch(() => null);
            if (!configuredChannel) {
                return { channel: null, source: 'configured', reason: 'configured-channel-not-found', configuredId };
            }
            if (!canSendInChannel(configuredChannel, me)) {
                return { channel: null, source: 'configured', reason: 'configured-channel-no-permission', configuredId };
            }
            return { channel: configuredChannel, source: 'configured', reason: 'ok', configuredId };
        }
    } catch {
        // continue fallback
    }

    const system = guild.systemChannel;
    if (canSendInChannel(system, me)) {
        return { channel: system, source: 'system', reason: 'ok' };
    }

    const preferredTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
    const channels = guild.channels?.cache
        ? [...guild.channels.cache.values()]
        : [];

    const candidate = channels
        .filter((ch) => preferredTypes.includes(ch.type))
        .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
        .find((ch) => canSendInChannel(ch, me));

    if (candidate) {
        return { channel: candidate, source: 'fallback', reason: 'ok' };
    }

    return { channel: null, source: 'fallback', reason: 'no-writable-text-channel' };
}

async function announceBirthdaysForGuild(client, guild, dateInfo) {
    const guildId = String(guild.id);
    const guildUsers = await User.find(
        {
            guildID: guildId,
        },
        {
            userID: 1,
        }
    ).lean().catch(() => []);

    const memberIds = [...new Set((Array.isArray(guildUsers) ? guildUsers : []).map((x) => String(x?.userID || '')).filter(Boolean))];
    if (!memberIds.length) return { announced: 0, skipped: 0 };

    const rows = await User.find(
        {
            guildID: 'GLOBAL',
            userID: { $in: memberIds },
            'profile.birthday.day': dateInfo.day,
            'profile.birthday.month': dateInfo.month,
        },
        {
            userID: 1,
            profile: 1,
        }
    ).lean().catch(() => []);

    const birthdayUserIds = (Array.isArray(rows) ? rows : [])
        .filter((doc) => isAllowedInGuild(doc, guildId))
        .map((doc) => String(doc?.userID || ''))
        .filter(Boolean);

    const uniqueBirthdayUserIds = [...new Set(birthdayUserIds)];

    if (!uniqueBirthdayUserIds.length) return { announced: 0, skipped: 0 };

    const channel = await pickAnnouncementChannel(guild);
    if (!channel) return { announced: 0, skipped: uniqueBirthdayUserIds.length };

    // Reserva atómica por usuario/día para evitar duplicados entre ciclos/reconexiones.
    const toAnnounce = [];
    for (const userID of uniqueBirthdayUserIds) {
        const res = await BirthdayAnnouncement.updateOne(
            { guildID: guildId, userID, dateKey: dateInfo.dateKey },
            {
                $setOnInsert: {
                    guildID: guildId,
                    userID,
                    dateKey: dateInfo.dateKey,
                    channelID: String(channel.id),
                    announcedAt: new Date(),
                },
            },
            { upsert: true }
        ).catch(() => null);

        if (res && res.upsertedId) {
            toAnnounce.push(userID);
        }
    }

    if (!toAnnounce.length) return { announced: 0, skipped: uniqueBirthdayUserIds.length };

    const members = await Promise.all(
        toAnnounce.map(async (id) => {
            const m = await guild.members.fetch(id).catch(() => null);
            return { id, member: m };
        })
    );

    const birthdayLines = members.map(({ id, member }) => {
        const tag = member?.user?.tag || `@${id}`;
        return `> ❤ ${tag} (<@${id}>) 🎉`;
    });

    const embed = new EmbedBuilder()
        .setColor(Bot?.AccentColor || 0xFFB6E6)
        .setDescription('🍰 !Muchas felicidades a quienes cumplen años hoy! 🎊')
        .setImage(pickBirthdayBanner())
        .setFooter({
            text: `${guild.name} • Felicidades`,
        })
        .setTimestamp(new Date());

    await channel.send({
        content: ['🎉 **¡Cumpleaños de hoy!**', '', ...birthdayLines].join('\n'),
        embeds: [embed],
        allowedMentions: { users: toAnnounce },
    });

    return { announced: toAnnounce.length, skipped: uniqueBirthdayUserIds.length - toAnnounce.length };
}

async function getBirthdayAnnouncementDebugForGuild(client, guildId, timezone) {
    if (!client?.isReady?.()) {
        return {
            ok: false,
            reason: 'client-not-ready',
            dateKey: null,
            timezone,
        };
    }

    const guild = client.guilds?.cache?.get(String(guildId));
    if (!guild) {
        return {
            ok: false,
            reason: 'guild-not-found',
            dateKey: null,
            timezone,
        };
    }

    const dateInfo = getDatePartsInTimezone(timezone);
    const guildUsers = await User.find(
        {
            guildID: String(guild.id),
        },
        {
            userID: 1,
        }
    ).lean().catch(() => []);

    const memberIds = [...new Set((Array.isArray(guildUsers) ? guildUsers : []).map((x) => String(x?.userID || '')).filter(Boolean))];
    const rows = await User.find(
        {
            guildID: 'GLOBAL',
            userID: { $in: memberIds },
            'profile.birthday.day': dateInfo.day,
            'profile.birthday.month': dateInfo.month,
        },
        {
            userID: 1,
            profile: 1,
        }
    ).lean().catch(() => []);

    const matched = Array.isArray(rows) ? rows : [];
    const allowed = matched.filter((doc) => isAllowedInGuild(doc, guild.id));
    const uniqueIds = [...new Set(allowed.map((doc) => String(doc?.userID || '')).filter(Boolean))];

    const already = await BirthdayAnnouncement.find(
        {
            guildID: String(guild.id),
            dateKey: dateInfo.dateKey,
            userID: { $in: uniqueIds },
        },
        { userID: 1 }
    ).lean().catch(() => []);

    const alreadySet = new Set((Array.isArray(already) ? already : []).map((x) => String(x.userID)));
    const pending = uniqueIds.filter((id) => !alreadySet.has(id));

    const channelInfo = await pickAnnouncementChannelDetailed(guild);

    return {
        ok: true,
        timezone,
        dateKey: dateInfo.dateKey,
        matchedToday: matched.length,
        blockedByDeny: Math.max(0, matched.length - allowed.length),
        eligibleUnique: uniqueIds.length,
        alreadyAnnounced: alreadySet.size,
        pendingToSend: pending.length,
        samplePendingUsers: pending.slice(0, 5),
        channel: channelInfo.channel ? {
            id: String(channelInfo.channel.id),
            source: channelInfo.source,
        } : null,
        channelReason: channelInfo.reason,
    };
}

async function runBirthdayAnnouncements(client, timezone) {
    if (!client?.isReady?.()) return;

    const dateInfo = getDatePartsInTimezone(timezone);
    let totalAnnounced = 0;

    for (const guild of client.guilds.cache.values()) {
        try {
            const result = await announceBirthdaysForGuild(client, guild, dateInfo);
            totalAnnounced += Number(result?.announced || 0);
        } catch {
            // ignore guild-level errors so one guild does not stop the cycle
        }
    }

    if (totalAnnounced > 0) {
        logger.info(`[birthday] Anuncios enviados: ${totalAnnounced} (${dateInfo.dateKey})`);
    }
}

async function runBirthdayAnnouncementsForGuild(client, guildId, timezone) {
    if (!client?.isReady?.()) return { announced: 0, skipped: 0, dateKey: null };
    const guild = client.guilds?.cache?.get(String(guildId));
    if (!guild) return { announced: 0, skipped: 0, dateKey: null };

    const dateInfo = getDatePartsInTimezone(timezone);
    const result = await announceBirthdaysForGuild(client, guild, dateInfo).catch(() => ({ announced: 0, skipped: 0 }));
    return {
        announced: Number(result?.announced || 0),
        skipped: Number(result?.skipped || 0),
        dateKey: dateInfo.dateKey,
    };
}

async function resetBirthdayAnnouncementsForGuildDate(guildId, dateKey) {
    const key = String(dateKey || '').trim();
    if (!key) return { deleted: 0 };

    const res = await BirthdayAnnouncement.deleteMany({
        guildID: String(guildId),
        dateKey: key,
    }).catch(() => ({ deletedCount: 0 }));

    return { deleted: Number(res?.deletedCount || 0) };
}

function startBirthdayAnnouncements(client, { timezone = 'Europe/Madrid', intervalMs = 15 * 60 * 1000 } = {}) {
    if (!client) return;

    if (client.__birthdayAnnouncementInterval) {
        try { clearInterval(client.__birthdayAnnouncementInterval); } catch { }
    }

    client.__birthdayAnnouncementRunning = false;

    const tick = async () => {
        if (client.__birthdayAnnouncementRunning) return;
        client.__birthdayAnnouncementRunning = true;
        try {
            await runBirthdayAnnouncements(client, timezone);
        } finally {
            client.__birthdayAnnouncementRunning = false;
        }
    };

    tick().catch(() => null);
    client.__birthdayAnnouncementInterval = setInterval(() => {
        tick().catch(() => null);
    }, Math.max(60_000, Number(intervalMs) || 15 * 60 * 1000));

    try {
        client.__birthdayAnnouncementInterval.unref?.();
    } catch {
        // ignore
    }
}

module.exports = {
    startBirthdayAnnouncements,
    runBirthdayAnnouncementsForGuild,
    resetBirthdayAnnouncementsForGuildDate,
    getDateKeyForTimezone,
    getBirthdayAnnouncementDebugForGuild,
};