const { User } = require('../Models');

const GLOBAL_SCOPE_GUILD_ID = 'GLOBAL';

function normalizePhrase(input) {
    const text = String(input || '').trim();
    if (!text) return '';
    return text.slice(0, 180);
}

function parseBirthdayInput(input) {
    const raw = String(input || '').trim();
    if (!raw) return { ok: true, value: null };

    const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})$/);
    if (!match) {
        return { ok: false, message: 'Usa DD/MM o DD-MM. Ejemplo: 20/01' };
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const test = new Date(2004, month - 1, day);
    const valid = test.getFullYear() === 2004 && (test.getMonth() + 1) === month && test.getDate() === day;
    if (!valid) {
        return { ok: false, message: 'La fecha de cumpleaños no es valida.' };
    }

    return { ok: true, value: { day, month } };
}

function formatBirthday(value) {
    const day = Number(value?.day);
    const month = Number(value?.month);
    if (!Number.isInteger(day) || !Number.isInteger(month) || day <= 0 || month <= 0) return 'No configurado';
    return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
}

function parseProfileNumber(input, label) {
    const raw = String(input || '').trim();
    if (!raw) return { ok: false, message: `Falta el valor para ${label}.` };

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
        return { ok: false, message: `${label} debe ser un numero mayor o igual a 0.` };
    }

    return { ok: true, value: Math.trunc(value) };
}

async function ensureUserDoc(guildId, userId, username = '') {
    let doc = await User.findOne({ guildID: GLOBAL_SCOPE_GUILD_ID, userID: userId }).catch(() => null);
    if (!doc) {
        doc = await User.findOne({ userID: userId }).sort({ updatedAt: -1, createdAt: -1 }).catch(() => null);
        if (doc) doc.guildID = GLOBAL_SCOPE_GUILD_ID;
    }
    if (!doc) {
        doc = await User.create({ guildID: GLOBAL_SCOPE_GUILD_ID, userID: userId, username }).catch(() => null);
    }
    if (!doc) throw new Error('USER_DOC_CREATE_FAILED');
    if (username && doc.username !== username) doc.username = username;
    doc.profile = doc.profile && typeof doc.profile === 'object' ? doc.profile : {};
    doc.profile.stats = doc.profile.stats && typeof doc.profile.stats === 'object'
        ? doc.profile.stats
        : { pats: 0, charisma: 0, deaths: 0 };
    doc.profile.birthday = doc.profile.birthday && typeof doc.profile.birthday === 'object'
        ? doc.profile.birthday
        : { day: null, month: null };
    doc.profile.birthdayConfig = doc.profile.birthdayConfig && typeof doc.profile.birthdayConfig === 'object'
        ? doc.profile.birthdayConfig
        : { blockedGuilds: [], lastSetAt: null };
    if (!Array.isArray(doc.profile.birthdayConfig.blockedGuilds)) {
        doc.profile.birthdayConfig.blockedGuilds = [];
    }
    return doc;
}

async function updateUserProfile(guildId, user, updates = {}) {
    const doc = await ensureUserDoc(guildId, user.id, user.username);

    if (Object.prototype.hasOwnProperty.call(updates, 'phrase')) {
        doc.profile.phrase = normalizePhrase(updates.phrase);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'birthday')) {
        const birthday = updates.birthday;
        if (!birthday) {
            doc.profile.birthday = { day: null, month: null };
        } else {
            doc.profile.birthday = {
                day: Number(birthday.day) || null,
                month: Number(birthday.month) || null,
            };
            doc.profile.birthdayConfig.lastSetAt = new Date();
        }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'pats')) {
        doc.profile.stats.pats = Math.max(0, Number(updates.pats) || 0);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'charisma')) {
        doc.profile.stats.charisma = Math.max(0, Number(updates.charisma) || 0);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'deaths')) {
        doc.profile.stats.deaths = Math.max(0, Number(updates.deaths) || 0);
    }

    doc.markModified('profile');
    await doc.save();
    return doc;
}

async function setBirthdayGuildAccess(guildId, user, allow = true) {
    const doc = await ensureUserDoc(guildId, user.id, user.username);
    const current = new Set((doc?.profile?.birthdayConfig?.blockedGuilds || []).map((x) => String(x)));
    if (allow) current.delete(String(guildId));
    else current.add(String(guildId));
    doc.profile.birthdayConfig.blockedGuilds = Array.from(current);
    doc.markModified('profile');
    await doc.save();
    return doc;
}

module.exports = {
    normalizePhrase,
    parseBirthdayInput,
    parseProfileNumber,
    formatBirthday,
    ensureUserDoc,
    setBirthdayGuildAccess,
    updateUserProfile,
};