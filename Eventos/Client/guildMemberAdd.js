const Moxi = require('../../index');
const Welcome = require('../../Models/WelcomeSchema');
const Servers = require('../../Models/GuildSchema');
const { AttachmentBuilder, PermissionsBitField } = require('discord.js');
const { buildSylphaGreeting } = require('../../Util/sylphacard');
const { buildDiscordArtsProfile } = require('../../Util/discordArts');
const { buildCanvacardWelcomeLeave } = require('../../Util/canvacard');
const { Bot } = require('../../Config');
const debugHelper = require('../../Util/debugHelper');

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

function getWelcomeTemplateForLang(serverDoc, cfg) {
    const lang = (serverDoc?.Language && typeof serverDoc.Language === 'string')
        ? String(serverDoc.Language)
        : (process.env.DEFAULT_LANG || 'es-ES');
    const messages = cfg?.messages;
    if (messages && typeof messages === 'object') {
        const v = messages instanceof Map ? messages.get(lang) : messages[lang];
        if (v && String(v).trim()) return { lang, template: String(v) };
    }
    if (cfg?.message && String(cfg.message).trim()) return { lang, template: String(cfg.message) };
    return { lang, template: '' };
}

Moxi.on('guildMemberAdd', async (member) => {

    try {
        const guildId = member?.guild?.id;
        debugHelper.log('welcome', 'guildMemberAdd', { guildId, userId: member?.user?.id });
        if (!guildId) return;

        const serverDoc = await Servers.findOne({ guildID: guildId }).lean().catch((err) => {
            debugHelper.error('welcome', 'DB findOne failed', err);
            return null;
        });
        const cfg = serverDoc?.Welcome;
        debugHelper.log('welcome', 'config', { enabled: !!cfg?.enabled, channelID: cfg?.channelID });
        if (!cfg?.enabled) return;
        const style = (cfg?.style && typeof cfg.style === 'string') ? cfg.style : 'sylphacard';
        const channelId = cfg?.channelID ? String(cfg.channelID) : '';
        if (!channelId) return;

        const channel = member.guild.channels.cache.get(channelId) || await member.guild.channels.fetch(channelId).catch((err) => {
            debugHelper.log('welcome', 'channel fetch failed', { channelId, error: err?.message || String(err) });
            return null;
        });
        if (!channel || typeof channel.send !== 'function') return;
        debugHelper.log('welcome', 'channel resolved', { channelId: channel.id, channelType: channel.type });

        const me = member.guild.members.me || await member.guild.members.fetch(Moxi.user.id).catch(() => null);
        const perms = me ? channel?.permissionsFor?.(me) : null;
        const required = [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles,
        ];
        if (!perms || !required.every(p => perms.has(p))) {
            const missing = perms ? perms.missing(required) : ['ViewChannel', 'SendMessages', 'AttachFiles'];
            debugHelper.log('welcome', 'missing perms', { channelId: channel?.id, missing });
            return;
        }

        const avatarUrl = member.user.displayAvatarURL({ size: 512, extension: 'png', forceStatic: true });

        const fetchedUser = await member.client.users.fetch(member.user.id, { force: true }).catch(() => null);
        const userBanner = fetchedUser?.bannerURL?.({ size: 2048, extension: 'png' }) || undefined;
        const guildBg = member.guild.bannerURL?.({ size: 2048, extension: 'png' }) || member.guild.iconURL?.({ size: 2048, extension: 'png' }) || undefined;
        const bg = userBanner || guildBg;
        debugHelper.log('welcome', 'background', { hasUserBanner: !!userBanner, hasGuildBg: !!guildBg });
        const username = member.user.username;
        const memberCount = String(member.guild.memberCount || 0);
        const resolved = getWelcomeTemplateForLang(serverDoc, cfg);
        debugHelper.log('welcome', 'template', { lang: resolved.lang, hasTemplate: !!resolved.template });
        const message = resolved.template
            ? applyTemplate(resolved.template, {
                user: username,
                server: member.guild.name,
                count: member.guild.memberCount || 0,
            })
            : undefined;

        let buffer;
        try {
            if (style === 'discord-arts') {
                buffer = await buildDiscordArtsProfile({
                    userId: member.user.id,
                    customTag: message,
                    customBackground: bg,
                });
            } else if (style === 'canvacard') {
                buffer = await buildCanvacardWelcomeLeave({
                    type: 'welcome',
                    avatarUrl,
                    backgroundUrl: bg,
                    title: `¡Bienvenid@ ${username}!`,
                    subtitle: message,
                });
            } else {
                buffer = await buildSylphaGreeting({
                    type: 'welcome',
                    username,
                    message,
                    memberCount,
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
            debugHelper.error('welcome', 'card generation failed', { style, err });

            if (style === 'discord-arts' || style === 'canvacard') {
                try {
                    buffer = await buildSylphaGreeting({
                        type: 'welcome',
                        username,
                        message,
                        memberCount,
                        avatarImage: avatarUrl,
                        backgroundImage: bg,
                        backgroundColor: '#0a192f',
                        primaryColor: '#e6f1ff',
                        textColor: '#e6f1ff',
                        secondaryTextColor: '#a8b2d1',
                        accentColor: toHexColor(Bot?.AccentColor, '#00d9ff'),
                        imageDarkness: 40,
                    });
                    debugHelper.log('welcome', 'fallback to sylphacard ok', { bytes: buffer?.length || 0 });
                } catch (err2) {
                    debugHelper.error('welcome', 'fallback sylphacard failed', err2);
                    return;
                }
            } else {
                return;
            }
        }

        debugHelper.log('welcome', 'card generated', { bytes: buffer?.length || 0 });

        const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });
        await channel.send({ content: `<@${member.user.id}>`, files: [attachment] });
        debugHelper.log('welcome', 'message sent', { channelId: channel.id });
    } catch (err) {
        debugHelper.error('welcome', 'guildMemberAdd failed', err);
    }
});
