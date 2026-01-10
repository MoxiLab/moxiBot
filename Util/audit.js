const { ContainerBuilder, MessageFlags, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const moxi = require('../i18n');
const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');

function actionLabel(action, lang) {
    const keyByAction = {
        ban: 'AUDIT_ACTION_BAN',
        kick: 'AUDIT_ACTION_KICK',
        timeout: 'AUDIT_ACTION_TIMEOUT',
        unban: 'AUDIT_ACTION_UNBAN',
        warn: 'AUDIT_ACTION_WARN',
        mute: 'AUDIT_ACTION_MUTE',
        unmute: 'AUDIT_ACTION_UNMUTE',
    };
    const key = keyByAction[action] || '';
    return key ? moxi.translate(`audit:${key}`, lang) : String(action || '');
}

async function resolveAuditConfig(guildId, fallbackLang) {
    const lang = await moxi.guildLang(guildId, fallbackLang);
    try {
        const { getGuildSettingsCached } = require('./guildSettings');
        const settings = await getGuildSettingsCached(guildId);
        const channelId = settings?.AuditChannelId ? String(settings.AuditChannelId) : '';
        const enabled = typeof settings?.AuditEnabled === 'boolean' ? settings.AuditEnabled : !!channelId;
        return { lang, channelId, enabled };
    } catch {
        return { lang, channelId: '', enabled: false };
    }
}

async function sendAuditLog({ client, guild, guildId, action, moderatorId, targetId, reason, fallbackLang = 'es-ES' }) {
    const gid = String(guildId || guild?.id || '');
    if (!gid) return false;

    const { lang, channelId, enabled } = await resolveAuditConfig(gid, fallbackLang);
    if (!enabled || !channelId) return false;

    const g = guild || (client?.guilds ? await client.guilds.fetch(gid).catch(() => null) : null);
    if (!g) return false;

    const ch = g.channels?.cache?.get(channelId) || (g.channels ? await g.channels.fetch(channelId).catch(() => null) : null);
    if (!ch || typeof ch.send !== 'function') return false;

    // Intentar obtener avatar y banner del usuario objetivo
    let targetUser = null;
    if (client?.users?.fetch && targetId) {
        targetUser = await client.users.fetch(String(targetId), { force: true }).catch(() => null);
    }

    const avatarUrl = targetUser?.displayAvatarURL ? targetUser.displayAvatarURL({ size: 2048, dynamic: true }) : null;
    const bannerUrl = targetUser?.banner
        ? `https://cdn.discordapp.com/banners/${targetUser.id}/${targetUser.banner}.${String(targetUser.banner).startsWith('a_') ? 'gif' : 'png'}?size=2048`
        : null;

    const safeReason = (reason && String(reason).trim()) ? String(reason).trim() : moxi.translate('audit:AUDIT_REASON_NONE', lang);
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('audit:AUDIT_LOG_TITLE', lang)}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(
            [
                `${EMOJIS.shield || ''} ${moxi.translate('audit:AUDIT_LINE_ACTION', lang, { action: actionLabel(action, lang) })}`.trim(),
                `${EMOJIS.user || ''} ${moxi.translate('audit:AUDIT_LINE_TARGET', lang, { target: targetId ? `<@${targetId}>` : '-' })}`.trim(),
                `${EMOJIS.user || ''} ${moxi.translate('audit:AUDIT_LINE_MODERATOR', lang, { moderator: moderatorId ? `<@${moderatorId}>` : '-' })}`.trim(),
                `${EMOJIS.edit || ''} ${moxi.translate('audit:AUDIT_LINE_REASON', lang, { reason: safeReason })}`.trim(),
                `${EMOJIS.time || ''} ${moxi.translate('audit:AUDIT_LINE_TIME', lang, { time: timeStr })}`.trim(),
            ].filter(Boolean).join('\n')
        ));

    const mediaItems = [];
    if (bannerUrl) mediaItems.push(new MediaGalleryItemBuilder().setURL(bannerUrl));
    if (avatarUrl) mediaItems.push(new MediaGalleryItemBuilder().setURL(avatarUrl));
    if (mediaItems.length) {
        container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...mediaItems));
    }

    await ch.send({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
    return true;
}

module.exports = {
    sendAuditLog,
};
