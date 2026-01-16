const { AttachmentBuilder, PermissionsBitField } = require('discord.js');
const moxi = require('../../../i18n');
const Welcome = require('../../../Models/WelcomeSchema');
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

function getWelcomeTemplateForLang(cfg, lang) {
    const safeLang = (lang && typeof lang === 'string') ? lang : '';
    const messages = cfg?.messages;
    if (messages && typeof messages === 'object') {
        const fromMap = messages instanceof Map ? messages.get(safeLang) : messages[safeLang];
        if (fromMap && String(fromMap).trim()) return String(fromMap);
    }
    if (cfg?.message && String(cfg.message).trim()) return String(cfg.message);
    return '';
}

async function getBackgroundUrl(member) {
    const fetchedUser = await member.client.users.fetch(member.id, { force: true }).catch(() => null);
    const userBanner = fetchedUser?.bannerURL?.({ size: 2048, extension: 'png' }) || undefined;
    const guildBg = member.guild.bannerURL?.({ size: 2048, extension: 'png' })
        || member.guild.iconURL?.({ size: 2048, extension: 'png' })
        || undefined;
    return userBanner || guildBg;
}

module.exports = async (member) => {
    const guild = member?.guild;
    if (!guild) return;

    const guildId = guild.id;

    const welcomeDoc = await Welcome.findOne({ guildID: guildId, type: 'config' }).lean().catch((err) => {
        debugHelper.error('welcome', 'Welcome.findOne failed (guildMemberAdd)', err);
        return null;
    });

    const legacyDoc = !welcomeDoc
        ? await GuildData.findOne({ guildID: guildId }).lean().catch((err) => {
            debugHelper.error('welcome', 'GuildData.findOne failed (guildMemberAdd)', err);
            return null;
        })
        : null;

    const cfg = welcomeDoc || legacyDoc?.Welcome;
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

    const avatarUrl = member.user.displayAvatarURL({ size: 512, extension: 'png', forceStatic: true });
    const bg = await getBackgroundUrl(member);

    const rawTemplate = getWelcomeTemplateForLang(cfg, lang);
    const msgText = rawTemplate
        ? applyTemplate(rawTemplate, { user: member.user.username, server: guild.name, count: guild.memberCount || 0 })
        : undefined;

    let buffer;
    try {
        if (style === 'discord-arts') {
            buffer = await buildDiscordArtsProfile({
                userId: member.id,
                customTag: msgText,
                customBackground: bg,
            });
        } else if (style === 'canvacard') {
            buffer = await buildCanvacardWelcomeLeave({
                type: 'welcome',
                avatarUrl,
                backgroundUrl: bg,
                title: `¡Bienvenid@ ${member.user.username}!`,
                subtitle: msgText,
            });
        } else {
            buffer = await buildSylphaGreeting({
                type: 'welcome',
                username: member.user.username,
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
        debugHelper.error('welcome', 'card generation failed (guildMemberAdd)', { style, err });
        try {
            buffer = await buildSylphaGreeting({
                type: 'welcome',
                username: member.user.username,
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
            debugHelper.error('welcome', 'fallback sylphacard failed (guildMemberAdd)', err2);
            return;
        }
    }

    if (!buffer) return;

    const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });
    await channel.send({ content: `<@${member.id}>`, files: [attachment] }).catch((err) => {
        debugHelper.error('welcome', 'send failed (guildMemberAdd)', err);
        return null;
    });
};
