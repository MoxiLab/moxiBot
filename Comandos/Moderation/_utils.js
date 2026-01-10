const moxi = require('../../i18n');

function pickMentionOrId(arg) {
    if (!arg) return null;
    const s = String(arg).trim();
    if (!s) return null;
    const m = s.match(/^<@!?(\d+)>$/);
    if (m) return m[1];
    if (/^\d{15,20}$/.test(s)) return s;
    return null;
}

async function resolveMemberFromArgs(message, args) {
    const mention = message.mentions?.members?.first?.();
    if (mention) return mention;

    const id = pickMentionOrId(args?.[0]);
    if (!id) return null;

    try {
        return await message.guild.members.fetch(id);
    } catch {
        return null;
    }
}

function resolveUserDisplay(userOrMember) {
    const user = userOrMember?.user || userOrMember;
    if (!user) return '';
    return `<@${user.id}>`;
}

function translatePermNames(lang, permKeys) {
    const names = (permKeys || []).map((k) => {
        const key = String(k);
        const t = moxi.translate(`permissions:${key}`, lang);
        return t && t !== `permissions:${key}` ? t : key;
    });
    return names.join(', ');
}

function hasAll(permsObj, permBits) {
    try {
        return permsObj?.has?.(permBits);
    } catch {
        return false;
    }
}

async function ensureUserAndBotPerms({ message, lang, userPermBits, userPermKeys, botPermBits, botPermKeys }) {
    const memberPerms = message.member?.permissions;
    if (userPermBits && !hasAll(memberPerms, userPermBits)) {
        return { ok: false, reply: moxi.translate('MISSING_PERMISSION', lang, { PERMISSIONS: translatePermNames(lang, userPermKeys), guild: message.guild?.name || 'este servidor' }) };
    }

    const me = message.guild?.members?.me;
    const botPerms = me?.permissions;
    if (botPermBits && !hasAll(botPerms, botPermBits)) {
        return { ok: false, reply: moxi.translate('MISSING_PERMISSION', lang, { PERMISSIONS: translatePermNames(lang, botPermKeys), guild: message.guild?.name || 'este servidor' }) };
    }

    return { ok: true };
}

module.exports = {
    resolveMemberFromArgs,
    resolveUserDisplay,
    ensureUserAndBotPerms,
    pickMentionOrId,
};
