const path = require('node:path');

const { User } = require(path.join(__dirname, '..', '..', 'Models'));

async function getUser(guildID, userID, username) {
    const gid = String(guildID || '').trim();
    const uid = String(userID || '').trim();
    if (!gid || !uid) return null;

    let doc = await User.findOne({ guildID: gid, userID: uid }).catch(() => null);
    if (!doc) {
        doc = await User.create({
            guildID: gid,
            userID: uid,
            username: username ? String(username) : undefined,
        }).catch(() => null);
    }
    if (!doc) return null;

    if (username && doc.username !== username) {
        doc.username = String(username);
        await doc.save().catch(() => null);
    }

    return doc;
}

async function getUserLevelInfo(guildID, userID) {
    const doc = await User.findOne({ guildID: String(guildID), userID: String(userID) }).lean().catch(() => null);
    if (!doc) return null;
    return {
        level: doc.level || 1,
        currentXp: doc.xp || 0,
        totalXp: doc.totalXp || 0,
        prestige: doc.prestige || 0,
    };
}

async function setLevel(guildID, userID, level, username) {
    const doc = await getUser(guildID, userID, username);
    if (!doc) return null;

    const newLevel = Math.max(1, Number(level) || 1);
    doc.level = newLevel;
    doc.xp = 0;
    doc.updatedAt = new Date();
    await doc.save().catch(() => null);
    return doc;
}

async function resetUser(guildID, userID) {
    const gid = String(guildID || '').trim();
    const uid = String(userID || '').trim();
    if (!gid || !uid) return null;

    const doc = await User.findOne({ guildID: gid, userID: uid }).catch(() => null);
    if (!doc) return null;

    doc.level = 1;
    doc.xp = 0;
    doc.totalXp = 0;
    doc.prestige = 0;
    doc.rank = 0;
    doc.streak = 0;
    doc.lastStreakDate = null;
    doc.maxStreak = 0;
    doc.badges = [];
    doc.stats = {
        messagesCount: 0,
        reactionsReceived: 0,
        levelUps: 0,
        prestigeCount: 0,
        bonusXpEarned: 0,
    };
    doc.lastXpGain = new Date(0);
    doc.lastDailyBonus = null;
    doc.updatedAt = new Date();

    await doc.save().catch(() => null);
    return doc;
}

async function seasonalReset(guildID) {
    const gid = String(guildID || '').trim();
    if (!gid) return null;

    const res = await User.updateMany(
        { guildID: gid },
        {
            $set: {
                level: 1,
                xp: 0,
                totalXp: 0,
                prestige: 0,
                rank: 0,
                streak: 0,
                lastStreakDate: null,
                maxStreak: 0,
                badges: [],
                stats: {
                    messagesCount: 0,
                    reactionsReceived: 0,
                    levelUps: 0,
                    prestigeCount: 0,
                    bonusXpEarned: 0,
                },
                lastXpGain: new Date(0),
                lastDailyBonus: null,
                updatedAt: new Date(),
            }
        }
    ).catch(() => null);

    if (!res) return null;
    return { modifiedCount: res.modifiedCount ?? res.nModified ?? 0 };
}

async function prestige(guildID, userID) {
    const doc = await User.findOne({ guildID: String(guildID), userID: String(userID) }).catch(() => null);
    if (!doc) return null;

    doc.prestige = (doc.prestige || 0) + 1;
    doc.level = 1;
    doc.xp = 0;
    doc.stats = doc.stats || {};
    doc.stats.prestigeCount = (doc.stats.prestigeCount || 0) + 1;
    doc.updatedAt = new Date();
    await doc.save().catch(() => null);
    return doc;
}

async function getLeaderboard(guildID, limit = 10, sortBy = 'level') {
    const gid = String(guildID || '').trim();
    if (!gid) return [];

    const lim = Math.max(1, Math.min(100, Number(limit) || 10));
    const key = String(sortBy || 'level').toLowerCase();

    let sort;
    if (key === 'xp') sort = { totalXp: -1, level: -1, prestige: -1 };
    else if (key === 'prestige') sort = { prestige: -1, level: -1, totalXp: -1 };
    else if (key === 'messages') sort = { 'stats.messagesCount': -1, level: -1, totalXp: -1 };
    else sort = { level: -1, prestige: -1, totalXp: -1 };

    return await User.find({ guildID: gid })
        .sort(sort)
        .limit(lim)
        .select({ username: 1, level: 1, totalXp: 1, prestige: 1, stats: 1, userID: 1 })
        .lean()
        .catch(() => []);
}

async function getUserRank(guildID, userID, sortBy = 'level') {
    const gid = String(guildID || '').trim();
    const uid = String(userID || '').trim();
    if (!gid || !uid) return null;

    const doc = await User.findOne({ guildID: gid, userID: uid }).lean().catch(() => null);
    if (!doc) return null;

    const key = String(sortBy || 'level').toLowerCase();

    if (key === 'xp') {
        const higher = await User.countDocuments({ guildID: gid, totalXp: { $gt: doc.totalXp || 0 } }).catch(() => 0);
        return higher + 1;
    }
    if (key === 'prestige') {
        const higher = await User.countDocuments({ guildID: gid, prestige: { $gt: doc.prestige || 0 } }).catch(() => 0);
        return higher + 1;
    }
    if (key === 'messages') {
        const my = (doc.stats && doc.stats.messagesCount) ? doc.stats.messagesCount : 0;
        const higher = await User.countDocuments({ guildID: gid, 'stats.messagesCount': { $gt: my } }).catch(() => 0);
        return higher + 1;
    }

    const higher = await User.countDocuments({ guildID: gid, level: { $gt: doc.level || 1 } }).catch(() => 0);
    return higher + 1;
}

async function getUserStats(guildID, userID) {
    const gid = String(guildID || '').trim();
    const uid = String(userID || '').trim();
    if (!gid || !uid) return null;

    const doc = await User.findOne({ guildID: gid, userID: uid }).lean().catch(() => null);
    if (!doc) return null;

    const messages = (doc.stats && doc.stats.messagesCount) ? doc.stats.messagesCount : 0;
    const reactions = (doc.stats && doc.stats.reactionsReceived) ? doc.stats.reactionsReceived : 0;
    const levelUps = (doc.stats && doc.stats.levelUps) ? doc.stats.levelUps : 0;
    const bonusXp = (doc.stats && doc.stats.bonusXpEarned) ? doc.stats.bonusXpEarned : 0;

    const rank = await getUserRank(gid, uid, 'level');

    return {
        level: doc.level || 1,
        prestige: doc.prestige || 0,
        rank: rank || 0,
        totalXp: doc.totalXp || 0,
        levelUps,
        bonusXp,
        messages,
        reactions,
        streak: doc.streak || 0,
        badges: Array.isArray(doc.badges) ? doc.badges.length : 0,
        maxStreak: doc.maxStreak || 0,
        joinedAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    };
}

module.exports = {
    getUser,
    getUserLevelInfo,
    setLevel,
    resetUser,
    seasonalReset,
    prestige,
    getLeaderboard,
    getUserRank,
    getUserStats,
};
