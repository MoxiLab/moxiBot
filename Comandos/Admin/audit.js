const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { getGuildSettingsCached, invalidateGuildSettingsCache, setGuildAuditChannel, setGuildAuditEnabled } = require('../../Util/guildSettings');
const debugHelper = require('../../Util/debugHelper');

const { PermissionsBitField: { Flags }, ContainerBuilder, MessageFlags } = require('discord.js');

function buildPanel({ title, body }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body))
        .addSeparatorComponents(s => s.setDivider(true));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {
    name: 'audit',
    alias: ['modlog', 'auditlog'],
    description: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('audit:CMD_AUDIT_DESC', lang);
    },
    usage: 'audit set #canal | audit off | audit status',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    permissions: {
        User: [Flags.Administrator],
    },
    cooldown: 10,
    async execute(Moxi, message, args) {
        const guildId = message.guild?.id || 'dm';
        debugHelper.log('audit', 'execute start', {
            guildId,
            userId: message.author?.id,
            args: args.slice(0, 5),
            argsCount: args.length,
        });
        try {
            const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
            const sub = (args[0] || 'status').toLowerCase();

            if (sub === 'set') {
                const mentioned = message.mentions?.channels?.first?.();
                const raw = args[1];
                const id = mentioned?.id || (raw ? String(raw).replace(/[<#>]/g, '') : '');
                const ch = id ? (message.guild.channels.cache.get(id) || await message.guild.channels.fetch(id).catch(() => null)) : null;

                if (!ch) {
                    return message.reply(buildPanel({
                        title: moxi.translate('audit:AUDIT_PANEL_TITLE', lang),
                        body: `${EMOJIS.cross} ${moxi.translate('audit:AUDIT_USAGE', lang)}`,
                    }));
                }

                await setGuildAuditChannel(guildId, ch.id);
                invalidateGuildSettingsCache(guildId);
                message.guild.settings = message.guild.settings || {};
                message.guild.settings.AuditChannelId = ch.id;
                message.guild.settings.AuditEnabled = true;
                debugHelper.log('audit', 'set channel', { guildId, channelId: ch.id });

                return message.reply(buildPanel({
                    title: moxi.translate('audit:AUDIT_PANEL_TITLE', lang),
                    body: `${EMOJIS.tick} ${moxi.translate('audit:AUDIT_SET_SUCCESS', lang, { channel: `<#${ch.id}>` })}`,
                }));
            }

            if (sub === 'off' || sub === 'disable') {
                await setGuildAuditEnabled(guildId, false);
                invalidateGuildSettingsCache(guildId);
                message.guild.settings = message.guild.settings || {};
                message.guild.settings.AuditEnabled = false;
                debugHelper.log('audit', 'disabled', { guildId });

                return message.reply(buildPanel({
                    title: moxi.translate('audit:AUDIT_PANEL_TITLE', lang),
                    body: `${EMOJIS.tick} ${moxi.translate('audit:AUDIT_OFF_SUCCESS', lang)}`,
                }));
            }

            if (sub === 'on' || sub === 'enable') {
                const settings = await getGuildSettingsCached(guildId);
                const channelId = settings?.AuditChannelId ? String(settings.AuditChannelId) : '';
                if (!channelId) {
                    return message.reply(buildPanel({
                        title: moxi.translate('audit:AUDIT_PANEL_TITLE', lang),
                        body: `${EMOJIS.cross} ${moxi.translate('audit:AUDIT_USAGE', lang)}`,
                    }));
                }

                await setGuildAuditEnabled(guildId, true);
                invalidateGuildSettingsCache(guildId);
                message.guild.settings = message.guild.settings || {};
                message.guild.settings.AuditEnabled = true;
                debugHelper.log('audit', 'enabled', { guildId, channelId });

                return message.reply(buildPanel({
                    title: moxi.translate('audit:AUDIT_PANEL_TITLE', lang),
                    body: `${EMOJIS.tick} ${moxi.translate('audit:AUDIT_STATUS_TITLE', lang)}: ${moxi.translate('audit:AUDIT_STATUS_ON', lang)}`,
                }));
            }

            const settings = await getGuildSettingsCached(guildId);
            const channelId = settings?.AuditChannelId ? String(settings.AuditChannelId) : '';
            const enabled = typeof settings?.AuditEnabled === 'boolean' ? settings.AuditEnabled : !!channelId;
            const statusText = enabled ? moxi.translate('audit:AUDIT_STATUS_ON', lang) : moxi.translate('audit:AUDIT_STATUS_OFF', lang);
            const channelText = channelId ? `<#${channelId}>` : '-';
            const channelLabel = moxi.translate('audit:AUDIT_STATUS_CHANNEL', lang) || 'Channel';
            debugHelper.log('audit', 'status', { guildId, channelId, enabled });

            return message.reply(buildPanel({
                title: moxi.translate('audit:AUDIT_STATUS_TITLE', lang),
                body: `${EMOJIS.info || ''} ${moxi.translate('audit:AUDIT_STATUS_TITLE', lang)}: **${statusText}**\n${EMOJIS.channel || ''} ${channelLabel}: ${channelText}`.trim(),
            }));
        } catch (err) {
            debugHelper.error('audit', 'execute error', { guildId, error: err?.message || err });
            throw err;
        }
    },
};
