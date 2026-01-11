const Moxi = require('../../index');
const Byes = require('../../Models/ByesSchema');
const Servers = require('../../Models/GuildSchema');
const { AttachmentBuilder, PermissionsBitField } = require('discord.js');
const { buildSylphaGreeting } = require('../../Util/sylphacard');
const { buildDiscordArtsProfile } = require('../../Util/discordArts');
const { buildCanvacardWelcomeLeave } = require('../../Util/canvacard');
const { Bot } = require('../../Config');
const debugHelper = require('../../Util/debugHelper');
const { buildLogEventContainer } = require('../../Components/V2/logEvent');

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

function resolveByesTemplate(serverDoc, cfg) {
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

Moxi.on('guildMemberRemove', async (member) => {

    // --- Log visual V2 al canal de logs general configurado ---
    try {
        const Guild = require('../../Models/GuildSchema');
        const guildDoc = await Guild.findOne({ guildID: member.guild.id }).lean();
        const logChannelId = guildDoc?.logChannelID;
        if (logChannelId) {
            const logChannel = await member.guild.channels.fetch(logChannelId).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
                const container = buildLogEventContainer({
                    type: 'leave',
                    user: `${member.user?.username || 'Usuario'}`,
                    avatarURL: member.user?.displayAvatarURL?.() || '',
                    timestamp: new Date()
                });
                await logChannel.send({ content: '', components: [container] });
            }
        }
    } catch (e) {}
    // --- Fin log visual V2 ---

    try {
        const guildId = member?.guild?.id;
        if (!guildId) return;

        const userId = member?.user?.id || member?.id;
        if (!userId) return;

        const user = member?.user
            || await member.client.users.fetch(userId, { force: true }).catch(() => null);
        if (!user) return;

        const serverDoc = await Servers.findOne({ guildID: guildId }).lean().catch((err) => {
            debugHelper.error('byes', 'DB findOne failed', err);
            return null;
        });

        const cfg = serverDoc?.Byes;
        debugHelper.log('byes', 'config', { guildId, enabled: !!cfg?.enabled, channelID: cfg?.channelID });
        if (!cfg?.enabled) return;

        const style = (cfg?.style && typeof cfg.style === 'string') ? cfg.style : 'sylphacard';

        const channelId = cfg?.channelID ? String(cfg.channelID) : '';
        if (!channelId) return;

        const channel = member.guild.channels.cache.get(channelId) || await member.guild.channels.fetch(channelId).catch((err) => {
            debugHelper.log('byes', 'channel fetch failed', { channelId, error: err?.message || String(err) });
            return null;
        });

        if (!channel || typeof channel.send !== 'function') return;

        const me = member.guild.members.me || await member.guild.members.fetch(Moxi.user.id).catch(() => null);
        const perms = me ? channel?.permissionsFor?.(me) : null;
        const required = [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles,
        ];

        if (!perms || !required.every(p => perms.has(p))) {
            const missing = perms ? perms.missing(required) : ['ViewChannel', 'SendMessages', 'AttachFiles'];
            debugHelper.log('byes', 'missing perms', { channelId: channel?.id, missing });
            return;
        }

        const avatarUrl = user.displayAvatarURL({ size: 512, extension: 'png', forceStatic: true });
        const fetchedUser = await member.client.users.fetch(user.id, { force: true }).catch(() => null);
        const userBanner = fetchedUser?.bannerURL?.({ size: 2048, extension: 'png' }) || undefined;
        const guildBg = member.guild.bannerURL?.({ size: 2048, extension: 'png' }) || member.guild.iconURL?.({ size: 2048, extension: 'png' }) || undefined;
        const bg = userBanner || guildBg;

        const username = user.username;
        const memberCount = String(member.guild.memberCount || 0);

        const resolved = resolveByesTemplate(serverDoc, cfg);
        debugHelper.log('byes', 'template', { lang: resolved.lang, hasTemplate: !!resolved.template });

        const msgText = resolved.template
            ? applyTemplate(resolved.template, { user: username, server: member.guild.name, count: member.guild.memberCount || 0 })
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
                    title: `¡Adiós ${username}!`,
                    subtitle: msgText,
                });
            } else {
                buffer = await buildSylphaGreeting({
                    type: 'goodbye',
                    username,
                    message: msgText,
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
            debugHelper.log('byes', 'card generation failed', { style, error: err?.message || String(err) });
            debugHelper.error('byes', 'card generation failed', { style, err });

            if (style === 'discord-arts' || style === 'canvacard') {
                try {
                    buffer = await buildSylphaGreeting({
                        type: 'goodbye',
                        username,
                        message: msgText,
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
                    debugHelper.log('byes', 'fallback to sylphacard ok', { bytes: buffer?.length || 0 });
                } catch (err2) {
                    debugHelper.error('byes', 'fallback sylphacard failed', err2);
                    return;
                }
            } else {
                return;
            }
        }

        debugHelper.log('byes', 'card generated', { bytes: buffer?.length || 0 });

        const attachment = new AttachmentBuilder(buffer, { name: 'byes.png' });
        await channel.send({ files: [attachment] });
        debugHelper.log('byes', 'message sent', { channelId: channel.id });
    } catch (err) {
        debugHelper.error('byes', 'guildMemberRemove failed', err);
    }
});
