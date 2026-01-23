const { ensureMongoConnection } = require('./mongoConnect');
const { ActionRowBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');
const { Bot } = require('../Config');

const MAX_TIMEOUT_MS = 2_147_000_000; // ~24.8 días (límite práctico de setTimeout)

const inMemoryTimeouts = new Map(); // key -> timeout
const inMemoryReminders = new Map(); // key -> { guildId, channelId, userId, type, fireAt }

function reminderKey({ guildId, userId, type }) {
    return `${guildId || 'global'}:${userId}:${type}`;
}

function formatType(type) {
    switch (String(type)) {
        case 'work':
            return 'Work';
        case 'salary':
            return 'Salary';
        case 'crime':
            return 'Crime';
        case 'fish':
            return 'Fishing';
        case 'mine':
            return 'Mining';
        default:
            return String(type || 'Cooldown');
    }
}

function buildReminderMessage({ userId, type }) {
    const prefix = process.env.PREFIX || '.';
    const label = formatType(type);
    let hint = '';
    if (type === 'work') hint = ` Puedes usar \`${prefix}work\` / \`/work shift\`.`;
    if (type === 'salary') hint = ` Puedes usar \`${prefix}salary\`.`;
    if (type === 'crime') hint = ` Puedes usar \`${prefix}crime\`.`;
    if (type === 'fish') hint = ` Puedes volver a pescar.`;
    if (type === 'mine') hint = ` Puedes volver a minar.`;
    return `<@${userId}> 🔔 Tu cooldown de **${label}** ha terminado.${hint}`;
}

function getDefaultInviteUrl() {
    const clientId = process.env.CLIENT_ID;
    if (clientId) {
        return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&permissions=8&integration_type=0&scope=bot`;
    }
    return 'https://discord.com/oauth2/authorize?client_id=1456441655769956436&permissions=8&integration_type=0&scope=bot';
}

function buildReminderButtonsRow() {
    const topgg = process.env.TOPGG_VOTE_URL || 'https://top.gg/bot/moxi/vote';
    const dbl = process.env.DISCORDBOTLIST_VOTE_URL || 'https://discordbotlist.com/bots/moxi/upvote';
    const dbots = process.env.DBOTLIST_URL || 'https://dbots.fun/bot/moxi';
    const invite = process.env.BOT_INVITE_URL || getDefaultInviteUrl();
    const support = process.env.SUPPORT_SERVER_URL || 'https://discord.gg/tu-servidor';

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('top.gg').setStyle(ButtonStyle.Link).setURL(topgg),
        new ButtonBuilder().setLabel('discordbotlist').setStyle(ButtonStyle.Link).setURL(dbl),
        new ButtonBuilder().setLabel('dbots.fun').setStyle(ButtonStyle.Link).setURL(dbots),
        new ButtonBuilder().setLabel('Invite').setStyle(ButtonStyle.Link).setURL(invite),
        new ButtonBuilder().setLabel('Support').setStyle(ButtonStyle.Link).setURL(support),
    );
}

function buildReminderEmbed({ userId, type }) {
    const prefix = process.env.PREFIX || '.';
    const label = formatType(type);
    let hint = '';
    if (type === 'work') hint = `\n\nPuedes usar **${prefix}work** o **/work shift**.`;
    if (type === 'salary') hint = `\n\nPuedes usar **${prefix}salary**.`;
    if (type === 'crime') hint = `\n\nPuedes usar **${prefix}crime**.`;
    if (type === 'fish') hint = `\n\nYa puedes volver a pescar.`;
    if (type === 'mine') hint = `\n\nYa puedes volver a minar.`;

    return new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle('🔔 Cooldown terminado')
        .setDescription(`<@${userId}> Tu cooldown de **${label}** ha terminado.${hint}`)
        .setTimestamp(Date.now());
}

function buildReminderPayload({ userId, type }) {
    return {
        content: '',
        embeds: [buildReminderEmbed({ userId, type })],
        components: [buildReminderButtonsRow()],
        allowedMentions: { users: [String(userId)] },
    };
}

async function sendReminder({ client, guildId, channelId, userId, type }) {
    const payload = buildReminderPayload({ userId, type });

    // 1) DM primero (si está permitido)
    try {
        const user = await client.users.fetch(userId);
        if (user && typeof user.send === 'function') {
            await user.send(payload);
            return { ok: true, sentTo: 'dm' };
        }
    } catch {
        // ignore
    }

    // 2) Fallback a canal (si existe)
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel && typeof channel.send === 'function') {
            await channel.send(payload);
            return { ok: true, sentTo: 'channel' };
        }
    } catch {
        // ignore
    }

    return { ok: false, reason: 'send-failed' };
}

function clearScheduled(key) {
    const t = inMemoryTimeouts.get(key);
    if (t) clearTimeout(t);
    inMemoryTimeouts.delete(key);
}

function scheduleWithChunking({ delayMs, onFire }) {
    if (delayMs <= MAX_TIMEOUT_MS) {
        return setTimeout(onFire, Math.max(0, delayMs));
    }

    // Para delays muy grandes, encadena timeouts
    return setTimeout(() => {
        scheduleWithChunking({ delayMs: delayMs - MAX_TIMEOUT_MS, onFire });
    }, MAX_TIMEOUT_MS);
}

async function scheduleCooldownReminder({ client, guildId, channelId, userId, type, fireAt }) {
    const now = Date.now();
    const safeFireAt = Number.isFinite(Number(fireAt)) ? Number(fireAt) : (now + 5_000);
    const delayMs = Math.max(0, safeFireAt - now);

    const key = reminderKey({ guildId, userId, type });

    // --- Persistente (Mongo) si existe
    if (process.env.MONGODB) {
        try {
            await ensureMongoConnection();
            const CooldownReminder = require('../Models/CooldownReminderSchema');

            const doc = await CooldownReminder.findOneAndUpdate(
                { guildId, userId, type },
                { $set: { channelId, fireAt: safeFireAt, fired: false, canceled: false } },
                { upsert: true, new: true }
            );

            // Limpia timeout previo y agenda el nuevo
            clearScheduled(key);
            const timeout = scheduleWithChunking({
                delayMs,
                onFire: async () => {
                    try {
                        await sendReminder({ client, guildId, channelId, userId, type });
                    } finally {
                        inMemoryTimeouts.delete(key);
                        try {
                            await CooldownReminder.updateOne(
                                { _id: doc._id },
                                { $set: { fired: true } }
                            );
                        } catch {
                            // ignore
                        }
                    }
                },
            });
            inMemoryTimeouts.set(key, timeout);

            return { ok: true, persisted: true, fireAt: safeFireAt };
        } catch (e) {
            // Si falla Mongo, cae a memoria
        }
    }

    // --- Memoria (sin persistencia)
    inMemoryReminders.set(key, { guildId, channelId, userId, type, fireAt: safeFireAt });
    clearScheduled(key);
    const timeout = scheduleWithChunking({
        delayMs,
        onFire: async () => {
            try {
                await sendReminder({ client, guildId, channelId, userId, type });
            } finally {
                inMemoryTimeouts.delete(key);
                inMemoryReminders.delete(key);
            }
        },
    });
    inMemoryTimeouts.set(key, timeout);

    return { ok: true, persisted: false, fireAt: safeFireAt };
}

async function cancelCooldownReminder({ guildId, userId, type }) {
    const key = reminderKey({ guildId, userId, type });
    clearScheduled(key);
    inMemoryReminders.delete(key);

    if (process.env.MONGODB) {
        try {
            await ensureMongoConnection();
            const CooldownReminder = require('../Models/CooldownReminderSchema');
            await CooldownReminder.deleteOne({ guildId, userId, type });
        } catch {
            // ignore
        }
    }

    return { ok: true };
}

async function restoreCooldownReminders(client) {
    if (!process.env.MONGODB) return { ok: true, restored: 0 };

    try {
        await ensureMongoConnection();
        const CooldownReminder = require('../Models/CooldownReminderSchema');

        const docs = await CooldownReminder.find({ fired: false, canceled: false }).lean();
        const now = Date.now();

        for (const d of docs) {
            const key = reminderKey({ guildId: d.guildId, userId: d.userId, type: d.type });
            clearScheduled(key);

            const delayMs = Math.max(0, Number(d.fireAt || 0) - now);
            const timeout = scheduleWithChunking({
                delayMs,
                onFire: async () => {
                    try {
                        await sendReminder({ client, guildId: d.guildId, channelId: d.channelId, userId: d.userId, type: d.type });
                    } finally {
                        inMemoryTimeouts.delete(key);
                        try {
                            await CooldownReminder.updateOne({ _id: d._id }, { $set: { fired: true } });
                        } catch {
                            // ignore
                        }
                    }
                },
            });
            inMemoryTimeouts.set(key, timeout);
        }

        return { ok: true, restored: docs.length };
    } catch {
        return { ok: false, restored: 0 };
    }
}

module.exports = {
    formatType,
    scheduleCooldownReminder,
    cancelCooldownReminder,
    restoreCooldownReminders,
};
