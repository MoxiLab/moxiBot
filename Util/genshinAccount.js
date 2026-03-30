const User = require('../Models/UserSchema');

const GLOBAL_SCOPE_GUILD_ID = 'GLOBAL';

function normalizeRegion(input) {
    const raw = String(input || '').trim().toUpperCase();
    if (!raw) return null;
    if (raw === 'EU' || raw === 'NA' || raw === 'ASIA' || raw === 'SAR') return raw;
    if (raw === 'AMERICA' || raw === 'US') return 'NA';
    return null;
}

function detectRegionFromUid(uid) {
    const clean = String(uid || '').replace(/\D/g, '');
    if (clean.length !== 9) return null;

    const first = clean.charAt(0);
    if (first === '6') return 'NA';
    if (first === '7') return 'EU';
    if (first === '8') return 'ASIA';
    if (first === '9') return 'SAR';
    return null;
}

function normalizeUid(input) {
    const clean = String(input || '').replace(/\D/g, '');
    if (clean.length !== 9) return null;
    return clean;
}

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

    doc.profile = doc.profile && typeof doc.profile === 'object' ? doc.profile : {};
    doc.profile.genshin = doc.profile.genshin && typeof doc.profile.genshin === 'object'
        ? doc.profile.genshin
        : { uid: null, region: null, linkedAt: null, manualRoster: [], manualRosterUpdatedAt: null };

    if (!Array.isArray(doc.profile.genshin.manualRoster)) {
        doc.profile.genshin.manualRoster = [];
    }
    if (!Object.prototype.hasOwnProperty.call(doc.profile.genshin, 'manualRosterUpdatedAt')) {
        doc.profile.genshin.manualRosterUpdatedAt = null;
    }

    return doc;
}

module.exports = {
    normalizeUid,
    normalizeRegion,
    detectRegionFromUid,
    getGlobalUserDoc,
};
