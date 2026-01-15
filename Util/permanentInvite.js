const { PermissionFlagsBits } = require('discord.js');
const { ensureMongoConnection } = require('./mongoConnect');

const COLLECTION = 'permanent_invites';

async function readStoredInviteConfig(guildId) {
    if (!guildId) return null;
    if (!process.env.MONGODB || !String(process.env.MONGODB).trim()) return null;
    const connection = await ensureMongoConnection();
    const db = connection.db;
    return db.collection(COLLECTION).findOne({ guildId: String(guildId) });
}

async function writeStoredInviteConfig(guildId, patch) {
    if (!guildId) return false;
    if (!process.env.MONGODB || !String(process.env.MONGODB).trim()) return false;
    const connection = await ensureMongoConnection();
    const db = connection.db;
    const update = {
        $set: { ...patch, guildId: String(guildId), updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
    };
    const res = await db.collection(COLLECTION).updateOne({ guildId: String(guildId) }, update, { upsert: true });
    return !!(res.matchedCount || res.upsertedCount || res.modifiedCount);
}

async function validateStoredInvite({ guild, code }) {
    if (!guild || !code) return null;
    const client = guild.client;
    if (!client || typeof client.fetchInvite !== 'function') return null;
    const inv = await client.fetchInvite(code).catch(() => null);
    if (!inv) return null;

    const sameGuild = (inv.guild && inv.guild.id) ? inv.guild.id === guild.id : true;
    if (!sameGuild) return null;

    const permanent = inv.maxAge === 0 && inv.maxUses === 0 && inv.temporary === false;
    if (!permanent) return null;

    return inv;
}

function isInviteCreatableChannel(channel) {
    return !!channel && typeof channel.createInvite === 'function';
}

function botCanCreateInvite(channel, guild) {
    const me = guild?.members?.me;
    if (!me || !channel || typeof channel.permissionsFor !== 'function') return false;
    const perms = channel.permissionsFor(me);
    return !!perms && perms.has(PermissionFlagsBits.CreateInstantInvite);
}

function pickDefaultInviteChannel(guild) {
    if (!guild) return null;

    const preferred = [guild.systemChannel, guild.rulesChannel, guild.publicUpdatesChannel].filter(Boolean);
    for (const ch of preferred) {
        if (isInviteCreatableChannel(ch) && botCanCreateInvite(ch, guild)) return ch;
    }

    const me = guild.members?.me;
    if (!me) return null;

    // Elegir el primer canal de texto visible donde el bot pueda crear invitaciones.
    const channels = guild.channels?.cache;
    if (!channels) return null;

    const candidates = channels
        .filter((ch) => isInviteCreatableChannel(ch) && botCanCreateInvite(ch, guild))
        .sort((a, b) => {
            const pa = typeof a.rawPosition === 'number' ? a.rawPosition : 0;
            const pb = typeof b.rawPosition === 'number' ? b.rawPosition : 0;
            return pa - pb;
        });

    return candidates.first() || null;
}

async function getOrCreatePermanentInvite({ guild, channel, reason, requestedByUserId, requestedByTag }) {
    if (!guild) throw new Error('Missing guild');

    // 1) Si hay invite persistida, validarla y reutilizarla (sin crear nuevas).
    const stored = await readStoredInviteConfig(guild.id).catch(() => null);
    if (stored?.code) {
        const valid = await validateStoredInvite({ guild, code: stored.code });
        if (valid) {
            return {
                invite: valid,
                created: false,
                stored,
                channelId: stored.channelId || valid.channelId || valid.channel?.id || null,
            };
        }
    }

    let targetChannel = channel;
    if (!targetChannel || !isInviteCreatableChannel(targetChannel)) {
        targetChannel = pickDefaultInviteChannel(guild);
    }

    const me = guild.members?.me;
    if (!me) throw new Error('Bot member not available');

    // 2) Si el bot puede listar invites, intentar reutilizar una existente (y persistirla).
    const canFetchInvites = me.permissions?.has(PermissionFlagsBits.ManageGuild);
    if (canFetchInvites && guild.invites && typeof guild.invites.fetch === 'function') {
        const invites = await guild.invites.fetch().catch(() => null);
        if (invites) {
            const botId = guild.client?.user?.id;

            // Preferir una invitación permanente creada por el bot.
            const existingBotPermanent = invites.find((inv) => {
                const permanent = inv.maxAge === 0 && inv.maxUses === 0 && inv.temporary === false;
                const byBot = botId ? inv.inviterId === botId : false;
                return permanent && byBot;
            });
            if (existingBotPermanent) {
                await writeStoredInviteConfig(guild.id, {
                    code: existingBotPermanent.code,
                    channelId: existingBotPermanent.channelId,
                    requestedByUserId: stored?.requestedByUserId || requestedByUserId || null,
                    requestedByTag: stored?.requestedByTag || requestedByTag || null,
                }).catch(() => null);
                return { invite: existingBotPermanent, created: false, stored: await readStoredInviteConfig(guild.id).catch(() => null), channelId: existingBotPermanent.channelId };
            }

            // Si hay una permanente (aunque no sea del bot), reusarla.
            const anyPermanent = invites.find((inv) => inv.maxAge === 0 && inv.maxUses === 0 && inv.temporary === false);
            if (anyPermanent) {
                await writeStoredInviteConfig(guild.id, {
                    code: anyPermanent.code,
                    channelId: anyPermanent.channelId,
                    requestedByUserId: stored?.requestedByUserId || requestedByUserId || null,
                    requestedByTag: stored?.requestedByTag || requestedByTag || null,
                }).catch(() => null);
                return { invite: anyPermanent, created: false, stored: await readStoredInviteConfig(guild.id).catch(() => null), channelId: anyPermanent.channelId };
            }
        }
    }

    // 3) Crear UNA sola invitación (solo si no hay ninguna guardada/reutilizable).
    if (!targetChannel) throw new Error('No suitable channel found to create an invite');
    if (!botCanCreateInvite(targetChannel, guild)) throw new Error('Missing CreateInstantInvite permission');

    const createdInvite = await targetChannel.createInvite({
        maxAge: 0,
        maxUses: 0,
        temporary: false,
        unique: false,
        reason: reason || 'Permanent invite requested',
    });

    await writeStoredInviteConfig(guild.id, {
        code: createdInvite.code,
        channelId: targetChannel.id,
        requestedByUserId: requestedByUserId || null,
        requestedByTag: requestedByTag || null,
    }).catch(() => null);

    return {
        invite: createdInvite,
        created: true,
        stored: await readStoredInviteConfig(guild.id).catch(() => null),
        channelId: targetChannel.id,
    };
}

module.exports = {
    getOrCreatePermanentInvite,
    pickDefaultInviteChannel,
    isInviteCreatableChannel,
    readStoredInviteConfig,
    writeStoredInviteConfig,
};
