const RELATIONSHIP_TYPES = {
    amigo:   { label: 'amigo/a',        emoji: '💛' },
    mejor:   { label: 'mejor amigo/a',  emoji: '💜' },
    hermano: { label: 'hermano/a',      emoji: '💙' },
    crush:   { label: 'crush',          emoji: '❤️' },
    rival:   { label: 'rival',          emoji: '⚔️' },
    senpai:  { label: 'senpai',         emoji: '⭐' },
};

/**
 * Normaliza un input de texto al key del tipo de relación.
 * Devuelve null si no es válido.
 */
function resolveType(input) {
    if (!input) return 'amigo';
    const lower = String(input).toLowerCase().trim();

    if (RELATIONSHIP_TYPES[lower]) return lower;

    // aliases
    if (lower === 'amiga') return 'amigo';
    if (lower === 'mejor amigo' || lower === 'mejor amiga' || lower === 'bestie' || lower === 'bff') return 'mejor';
    if (lower === 'hermana' || lower === 'bro' || lower === 'sis') return 'hermano';

    return null;
}

const User = require('../Models/UserSchema');
const GLOBAL_SCOPE_GUILD_ID = 'GLOBAL';

async function getGlobalUserDoc(userId, username = '') {
    let doc = await User.findOne({ guildID: GLOBAL_SCOPE_GUILD_ID, userID: String(userId) });
    if (!doc) {
        doc = await User.findOne({ userID: String(userId) }).sort({ updatedAt: -1, createdAt: -1 });
        if (doc) doc.guildID = GLOBAL_SCOPE_GUILD_ID;
    }
    if (!doc) {
        doc = new User({ guildID: GLOBAL_SCOPE_GUILD_ID, userID: String(userId), username: String(username || '') });
    }
    if (username && doc.username !== username) doc.username = username;
    return doc;
}

/**
 * Agrega una relación al doc del usuario y guarda.
 */
async function addRelationship(userDoc, targetUserId, typeKey) {
    if (!Array.isArray(userDoc.relationships)) userDoc.relationships = [];

    if (userDoc.relationships.some((r) => String(r.userId) === String(targetUserId))) {
        return { ok: false, message: 'Ya tienes una relación registrada con ese usuario.' };
    }

    const now = new Date();
    userDoc.relationships.push({ userId: String(targetUserId), type: typeKey, since: now });

    userDoc.socialProgress = userDoc.socialProgress || {};
    userDoc.socialProgress.relationshipsCreated = Math.max(0, Number(userDoc.socialProgress.relationshipsCreated || 0)) + 1;
    if (!userDoc.socialProgress.firstRelationshipAt) userDoc.socialProgress.firstRelationshipAt = now;
    userDoc.socialProgress.lastRelationshipAt = now;

    userDoc.markModified('socialProgress');
    await userDoc.save();
    return { ok: true };
}

/**
 * Elimina una relación del doc del usuario y guarda.
 */
async function removeRelationship(userDoc, targetUserId) {
    if (!Array.isArray(userDoc.relationships)) userDoc.relationships = [];

    const idx = userDoc.relationships.findIndex((r) => String(r.userId) === String(targetUserId));
    if (idx === -1) {
        return { ok: false, message: 'No tienes ninguna relación registrada con ese usuario.' };
    }

    userDoc.relationships.splice(idx, 1);
    await userDoc.save();
    return { ok: true, removed: true };
}

module.exports = {
    RELATIONSHIP_TYPES,
    resolveType,
    getGlobalUserDoc,
    addRelationship,
    removeRelationship,
};
