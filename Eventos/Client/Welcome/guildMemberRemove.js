const { AttachmentBuilder, PermissionsBitField } = require('discord.js');
const moxi = require('../../../i18n');
const Byes = require('../../../Models/ByesSchema');
const GuildData = require('../../../Models/GuildSchema');
const { Bot } = require('../../../Config');
const { buildSylphaGreeting } = require('../../../Util/sylphacard');
const { buildDiscordArtsProfile } = require('../../../Util/discordArts');
const { buildCanvacardWelcomeLeave } = require('../../../Util/canvacard');
const debugHelper = require('../../../Util/debugHelper');

function toHexColor(value, fallback = '#00d9ff') {
    if (!value && value !== 0) return fallback;
    if (typeof value === 'string') {
        const v = value.trim();
        if (!v) return fallback;
        if (v.startsWith('#') && (v.length === 7 || v.length === 4)) return v;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const hex = (n >>> 0).toString(16).padStart(6, '0').slice(-6);
    return `#${hex}`;
}

function applyTemplate(template, { user, server, count }) {
    const base = (template && typeof template === 'string') ? template : '';
    return base
        .replace(/\{user\}/gi, user)
        .replace(/\{server\}/gi, server)
        .replace(/\{count\}/gi, String(count));
}

function getByesTemplateForLang(cfg, lang) {
    const safeLang = (lang && typeof lang === 'string') ? lang : '';
    const messages = cfg?.messages;
    if (messages && typeof messages === 'object') {
        const fromMap = messages instanceof Map ? messages.get(safeLang) : messages[safeLang];
        if (fromMap && String(fromMap).trim()) return String(fromMap);
    }
    if (cfg?.message && String(cfg.message).trim()) return String(cfg.message);
    return '';
}

async function getUserAndBackground(member) {
    const fetchedUser = await member.client.users.fetch(member.id, { force: true }).catch(() => null);
    const user = fetchedUser || member.user || null;
    if (!user) return { user: null, bg: undefined };

    const userBanner = fetchedUser?.bannerURL?.({ size: 2048, extension: 'png' }) || undefined;
    const guildBg = member.guild.bannerURL?.({ size: 2048, extension: 'png' })
        || member.guild.iconURL?.({ size: 2048, extension: 'png' })
        || undefined;

    return { user, bg: userBanner || guildBg };
}

module.exports = async (member) => {
    const guild = member?.guild;
    if (!guild) return;

    const guildId = guild.id;

    const byesDoc = await Byes.findOne({ guildID: guildId, type: 'config' }).lean().catch((err) => {
        debugHelper.error('byes', 'Byes.findOne failed (guildMemberRemove)', err);
        return null;
    });

    const legacyDoc = !byesDoc
        ? await GuildData.findOne({ guildID: guildId }).lean().catch((err) => {
            debugHelper.error('byes', 'GuildData.findOne failed (guildMemberRemove)', err);
            return null;
        })
        : null;

    const cfg = byesDoc || legacyDoc?.Byes;
    if (!cfg?.enabled || !cfg?.channelID) return;

    const channelId = String(cfg.channelID);
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || typeof channel.send !== 'function') return;

    const me = guild.members.me || await guild.members.fetch(member.client.user.id).catch(() => null);
    const perms = me ? channel.permissionsFor?.(me) : null;
    const required = [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.AttachFiles,
    ];
    if (!perms || !required.every(p => perms.has(p))) return;

    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
    const style = (cfg?.style && typeof cfg.style === 'string') ? cfg.style : 'sylphacard';

    const { user, bg } = await getUserAndBackground(member);
    if (!user) return;

    const avatarUrl = user.displayAvatarURL({ size: 512, extension: 'png', forceStatic: true });

    const rawTemplate = getByesTemplateForLang(cfg, lang);
    const msgText = rawTemplate
        ? applyTemplate(rawTemplate, { user: user.username, server: guild.name, count: guild.memberCount || 0 })
        : undefined;

    let buffer;
    try {
        if (style === 'discord-arts') {
            buffer = await buildDiscordArtsProfile({
                userId: user.id,
                customTag: msgText,
                customBackground: bg,
            });
        } else if (style === 'canvacard') {
            buffer = await buildCanvacardWelcomeLeave({
                type: 'leave',
                avatarUrl,
                backgroundUrl: bg,
                title: `¡Adiós ${user.username}!`,
                subtitle: msgText,
            });
        } else {
            buffer = await buildSylphaGreeting({
                type: 'goodbye',
                username: user.username,
                message: msgText,
                memberCount: String(guild.memberCount || 0),
                avatarImage: avatarUrl,
                backgroundImage: bg,
                backgroundColor: '#0a192f',
                primaryColor: '#e6f1ff',
                textColor: '#e6f1ff',
                secondaryTextColor: '#a8b2d1',
                accentColor: toHexColor(Bot?.AccentColor, '#00d9ff'),
                imageDarkness: 40,
            });
        }
    } catch (err) {
        debugHelper.error('byes', 'card generation failed (guildMemberRemove)', { style, err });
        try {
            buffer = await buildSylphaGreeting({
                type: 'goodbye',
                username: user.username,
                message: msgText,
                memberCount: String(guild.memberCount || 0),
                avatarImage: avatarUrl,
                backgroundImage: bg,
                backgroundColor: '#0a192f',
                primaryColor: '#e6f1ff',
                textColor: '#e6f1ff',
                secondaryTextColor: '#a8b2d1',
                accentColor: toHexColor(Bot?.AccentColor, '#00d9ff'),
                imageDarkness: 40,
            });
        } catch (err2) {
            debugHelper.error('byes', 'fallback sylphacard failed (guildMemberRemove)', err2);
            return;
        }
    }

    if (!buffer) return;

    const attachment = new AttachmentBuilder(buffer, { name: 'byes.png' });
    await channel.send({ files: [attachment] }).catch((err) => {
        debugHelper.error('byes', 'send failed (guildMemberRemove)', err);
        return null;
    });
};
