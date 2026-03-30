const { permissionInfoEmbed } = require('./auditPermissionEmbeds');
// Permite registrar avisos informativos de permisos insuficientes en el canal de auditoría
async function sendPermissionInfoLog({ client, guild, guildId, moderatorId, reason, fallbackLang = 'es-ES' }) {
    const gid = String(guildId || guild?.id || '');
    if (!gid) return false;

    const { lang, channelId, enabled } = await resolveAuditConfig(gid, fallbackLang);
    if (!enabled || !channelId) return false;

    const g = guild || (client?.guilds ? await client.guilds.fetch(gid).catch(() => null) : null);
    if (!g) return false;

    const ch = g.channels?.cache?.get(channelId) || (g.channels ? await g.channels.fetch(channelId).catch(() => null) : null);
    if (!ch || typeof ch.send !== 'function') return false;

    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const embed = permissionInfoEmbed({ moderatorId, reason, timeStr });
    await ch.send({ embeds: [embed] }).catch(() => null);
    return true;
}
const { ContainerBuilder, MessageFlags, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const moxi = require('../i18n');
const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');

function actionLabel(action, lang) {
    const keyByAction = {
        1: 'GUILD_UPDATE',
        10: 'CHANNEL_CREATE',
        11: 'CHANNEL_UPDATE',
        12: 'CHANNEL_DELETE',
        13: 'CHANNEL_OVERWRITE_CREATE',
        14: 'CHANNEL_OVERWRITE_UPDATE',
        15: 'CHANNEL_OVERWRITE_DELETE',
        20: 'MEMBER_KICK',
        21: 'MEMBER_PRUNE',
        22: 'MEMBER_BAN_ADD',
        23: 'MEMBER_BAN_REMOVE',
        24: 'MEMBER_UPDATE',
        25: 'MEMBER_ROLE_UPDATE',
        26: 'MEMBER_MOVE',
        27: 'MEMBER_DISCONNECT',
        28: 'BOT_ADD',
        30: 'ROLE_CREATE',
        31: 'ROLE_UPDATE',
        32: 'ROLE_DELETE',
        40: 'INVITE_CREATE',
        41: 'INVITE_UPDATE',
        42: 'INVITE_DELETE',
        50: 'WEBHOOK_CREATE',
        51: 'WEBHOOK_UPDATE',
        52: 'WEBHOOK_DELETE',
        60: 'EMOJI_CREATE',
        61: 'EMOJI_UPDATE',
        62: 'EMOJI_DELETE',
        72: 'MESSAGE_DELETE',
        73: 'MESSAGE_BULK_DELETE',
        74: 'MESSAGE_PIN',
        75: 'MESSAGE_UNPIN',
        80: 'INTEGRATION_CREATE',
        81: 'INTEGRATION_UPDATE',
        82: 'INTEGRATION_DELETE',
        83: 'STAGE_INSTANCE_CREATE',
        84: 'STAGE_INSTANCE_UPDATE',
        85: 'STAGE_INSTANCE_DELETE',
        90: 'STICKER_CREATE',
        91: 'STICKER_UPDATE',
        92: 'STICKER_DELETE',
        100: 'GUILD_SCHEDULED_EVENT_CREATE',
        101: 'GUILD_SCHEDULED_EVENT_UPDATE',
        102: 'GUILD_SCHEDULED_EVENT_DELETE',
        110: 'THREAD_CREATE',
        111: 'THREAD_UPDATE',
        112: 'THREAD_DELETE',
        121: 'APPLICATION_COMMAND_PERMISSION_UPDATE',
        130: 'SOUNDBOARD_SOUND_CREATE',
        131: 'SOUNDBOARD_SOUND_UPDATE',
        132: 'SOUNDBOARD_SOUND_DELETE',
        140: 'AUTO_MODERATION_RULE_CREATE',
        141: 'AUTO_MODERATION_RULE_UPDATE',
        142: 'AUTO_MODERATION_RULE_DELETE',
        143: 'AUTO_MODERATION_BLOCK_MESSAGE',
        144: 'AUTO_MODERATION_FLAG_TO_CHANNEL',
        145: 'AUTO_MODERATION_USER_COMMUNICATION_DISABLED',
        146: 'AUTO_MODERATION_QUARANTINE_USER',
        150: 'CREATOR_MONETIZATION_REQUEST_CREATED',
        151: 'CREATOR_MONETIZATION_TERMS_ACCEPTED',
        163: 'ONBOARDING_PROMPT_CREATE',
        164: 'ONBOARDING_PROMPT_UPDATE',
        165: 'ONBOARDING_PROMPT_DELETE',
        166: 'ONBOARDING_CREATE',
        167: 'ONBOARDING_UPDATE',
        190: 'HOME_SETTINGS_CREATE',
        191: 'HOME_SETTINGS_UPDATE',
    };
    // Permitir tanto string como number
    const actionType = typeof action === 'number' ? action : Number(action);
    const eventKey = keyByAction[actionType];
    // Si existe traducción, usarla, si no, mostrar el nombre oficial
    if (eventKey) {
        const translation = moxi.translate(`audit:${eventKey}`, lang);
        return translation !== `audit:${eventKey}` ? translation : eventKey;
    }
    return String(actionType || '');
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
    sendPermissionInfoLog,
    resolveAuditConfig,
};
