const {
    PermissionFlagsBits,
    ContainerBuilder,
    MessageFlags,
} = require('discord.js');

const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const {
    getGuildSettingsCached,
    invalidateGuildSettingsCache,
    setGuildAuditChannel,
    setGuildAuditEnabled,
} = require('../../Util/guildSettings');
const debugHelper = require('../../Util/debugHelper');

function buildPanel({ title, body }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body));
    return { content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 };
}

module.exports = {
    cooldown: 5,
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_ADMIN', lang),

    data: new SlashCommandBuilder()
        .setName('audit')
        .setDescription('Configura el canal de auditoría (modlog)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Establecer el canal de auditoría')
                .addChannelOption(o => o.setName('canal').setDescription('Canal donde enviar los logs').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('Ver el estado actual')
        )
        .addSubcommand(sub =>
            sub
                .setName('on')
                .setDescription('Activar auditoría (requiere canal configurado)')
        )
        .addSubcommand(sub =>
            sub
                .setName('off')
                .setDescription('Desactivar auditoría')
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const requesterId = interaction.user?.id;

        debugHelper.log('audit', 'slash run start', { guildId, requesterId, sub: interaction.options.getSubcommand() });

        if (!interaction.guild) {
            debugHelper.warn('audit', 'guild context missing', { guildId, requesterId });
            return interaction.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('GUILD_ONLY', lang) })),
                ephemeral: true,
            });
        }

        // Doble check por seguridad (aunque defaultMemberPermissions ya filtra)
        try {
            if (!interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator)) {
                debugHelper.warn('audit', 'missing admin permission', { guildId, requesterId });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('NO_PERMISSION', lang) })),
                    ephemeral: true,
                });
            }
        } catch {
            // ignore
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            const channel = interaction.options.getChannel('canal', true);
            debugHelper.log('audit', 'set request', { guildId, requesterId, channelId: channel.id });
            await setGuildAuditChannel(guildId, channel.id);
            invalidateGuildSettingsCache(guildId);

            interaction.guild.settings = interaction.guild.settings || {};
            interaction.guild.settings.AuditChannelId = channel.id;
            interaction.guild.settings.AuditEnabled = true;
            debugHelper.log('audit', 'set applied', { guildId, channelId: channel.id });

            return interaction.reply(buildPanel({
                title: moxi.translate('audit:AUDIT_PANEL_TITLE', lang),
                body: `${EMOJIS.tick} ${moxi.translate('audit:AUDIT_SET_SUCCESS', lang, { channel: `<#${channel.id}>` })}`,
            }));
        }

        if (sub === 'off') {
            debugHelper.log('audit', 'off request', { guildId, requesterId });
            await setGuildAuditEnabled(guildId, false);
            invalidateGuildSettingsCache(guildId);
            interaction.guild.settings = interaction.guild.settings || {};
            interaction.guild.settings.AuditEnabled = false;
            debugHelper.log('audit', 'off applied', { guildId });

            return interaction.reply(buildPanel({
                title: moxi.translate('audit:AUDIT_PANEL_TITLE', lang),
                body: `${EMOJIS.tick} ${moxi.translate('audit:AUDIT_OFF_SUCCESS', lang)}`,
            }));
        }

        if (sub === 'on') {
            debugHelper.log('audit', 'on request', { guildId, requesterId });
            const settings = await getGuildSettingsCached(guildId);
            const channelId = settings?.AuditChannelId ? String(settings.AuditChannelId) : '';
            if (!channelId) {
                debugHelper.warn('audit', 'on failed missing channel', { guildId });
                return interaction.reply(buildPanel({
                    title: moxi.translate('audit:AUDIT_PANEL_TITLE', lang),
                    body: `${EMOJIS.cross} ${moxi.translate('audit:AUDIT_USAGE', lang)}`,
                }));
            }
            await setGuildAuditEnabled(guildId, true);
            invalidateGuildSettingsCache(guildId);
            interaction.guild.settings = interaction.guild.settings || {};
            interaction.guild.settings.AuditEnabled = true;
            debugHelper.log('audit', 'on applied', { guildId, channelId });

            return interaction.reply(buildPanel({
                title: moxi.translate('audit:AUDIT_PANEL_TITLE', lang),
                body: `${EMOJIS.tick} ${moxi.translate('audit:AUDIT_STATUS_TITLE', lang)}: ${moxi.translate('audit:AUDIT_STATUS_ON', lang)}`,
            }));
        }

        // status
        debugHelper.log('audit', 'status request', { guildId, requesterId });
        const settings = await getGuildSettingsCached(guildId);
        const channelId = settings?.AuditChannelId ? String(settings.AuditChannelId) : '';
        const enabled = typeof settings?.AuditEnabled === 'boolean' ? settings.AuditEnabled : !!channelId;
        debugHelper.log('audit', 'status response', { guildId, enabled, channelId });
        const statusText = enabled ? moxi.translate('audit:AUDIT_STATUS_ON', lang) : moxi.translate('audit:AUDIT_STATUS_OFF', lang);
        const channelText = channelId ? `<#${channelId}>` : '-';
        const channelLabel = moxi.translate('audit:AUDIT_STATUS_CHANNEL', lang) || 'Channel';

        return interaction.reply(buildPanel({
            title: moxi.translate('audit:AUDIT_STATUS_TITLE', lang),
            body: `${EMOJIS.info || ''} ${moxi.translate('audit:AUDIT_STATUS_TITLE', lang)}: **${statusText}**\n${EMOJIS.channel || ''} ${channelLabel}: ${channelText}`.trim(),
        }));
    },
};
