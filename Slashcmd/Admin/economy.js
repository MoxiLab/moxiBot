const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    MessageFlags,
} = require('discord.js');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const {
    getGuildSettingsCached,
    invalidateGuildSettingsCache,
    setGuildEconomyEnabled,
    setGuildEconomyChannel,
    setGuildEconomyExclusive,
} = require('../../Util/guildSettings');

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
        .setName('economy')
        .setDescription('Configura economía: toggle y canal dedicado')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('status').setDescription('Ver el estado actual'))
        .addSubcommand(sub => sub.setName('on').setDescription('Activar economía'))
        .addSubcommand(sub => sub.setName('off').setDescription('Desactivar economía'))
        .addSubcommand(sub =>
            sub
                .setName('set-channel')
                .setDescription('Establecer el canal de economía')
                .addChannelOption(o => o.setName('canal').setDescription('Canal dedicado para economía').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('clear-channel')
                .setDescription('Quitar restricción de canal de economía')
        )
        .addSubcommand(sub =>
            sub
                .setName('exclusive')
                .setDescription('Bloquear comandos no-econ en el canal de economía')
                .addBooleanOption(o => o.setName('activo').setDescription('Activar/desactivar').setRequired(true))
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        if (!interaction.guild) {
            return interaction.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.cross} ${moxi.translate('GUILD_ONLY', lang) || 'Solo en servidores.'}`,
            }));
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'on') {
            await setGuildEconomyEnabled(guildId, true);
            invalidateGuildSettingsCache(guildId);
            return interaction.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.tick} ${moxi.translate('misc:ECONOMY_ADMIN_ENABLED', lang) || 'Economía activada.'}`,
            }));
        }

        if (sub === 'off') {
            await setGuildEconomyEnabled(guildId, false);
            invalidateGuildSettingsCache(guildId);
            return interaction.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.tick} ${moxi.translate('misc:ECONOMY_ADMIN_DISABLED', lang) || 'Economía desactivada.'}`,
            }));
        }

        if (sub === 'set-channel') {
            const channel = interaction.options.getChannel('canal', true);
            await setGuildEconomyChannel(guildId, channel.id);
            invalidateGuildSettingsCache(guildId);
            return interaction.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.tick} ${moxi.translate('misc:ECONOMY_ADMIN_CHANNEL_SET', lang, { channel: `<#${channel.id}>` }) || `Canal de economía: <#${channel.id}>`}`,
            }));
        }

        if (sub === 'clear-channel') {
            await setGuildEconomyChannel(guildId, null);
            invalidateGuildSettingsCache(guildId);
            return interaction.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.tick} ${moxi.translate('misc:ECONOMY_ADMIN_CHANNEL_CLEARED', lang) || 'Restricción de canal eliminada.'}`,
            }));
        }

        if (sub === 'exclusive') {
            const active = interaction.options.getBoolean('activo', true);
            await setGuildEconomyExclusive(guildId, !!active);
            invalidateGuildSettingsCache(guildId);
            return interaction.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.tick} ${active
                    ? (moxi.translate('misc:ECONOMY_ADMIN_EXCLUSIVE_ON', lang) || 'Canal exclusivo activado.')
                    : (moxi.translate('misc:ECONOMY_ADMIN_EXCLUSIVE_OFF', lang) || 'Canal exclusivo desactivado.')}`,
            }));
        }

        // status
        const settings = await getGuildSettingsCached(guildId);
        const econEnabled = (typeof settings?.EconomyEnabled === 'boolean') ? settings.EconomyEnabled : true;
        const econChannelId = settings?.EconomyChannelId ? String(settings.EconomyChannelId) : '';
        const econExclusive = (typeof settings?.EconomyExclusive === 'boolean') ? settings.EconomyExclusive : !!econChannelId;

        const enabledText = econEnabled
            ? (moxi.translate('misc:ECONOMY_ADMIN_STATUS_ON', lang) || 'ON')
            : (moxi.translate('misc:ECONOMY_ADMIN_STATUS_OFF', lang) || 'OFF');
        const channelText = econChannelId ? `<#${econChannelId}>` : '-';
        const exclusiveText = econExclusive
            ? (moxi.translate('misc:ECONOMY_ADMIN_STATUS_ON', lang) || 'ON')
            : (moxi.translate('misc:ECONOMY_ADMIN_STATUS_OFF', lang) || 'OFF');

        return interaction.reply(buildPanel({
            title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
            body: `${EMOJIS.info || ''} ${moxi.translate('misc:ECONOMY_ADMIN_STATUS_TITLE', lang) || 'Estado'}: **${enabledText}**\n` +
                `${EMOJIS.channel || ''} ${moxi.translate('misc:ECONOMY_ADMIN_STATUS_CHANNEL', lang) || 'Canal'}: ${channelText}\n` +
                `${EMOJIS.lock || ''} ${moxi.translate('misc:ECONOMY_ADMIN_STATUS_EXCLUSIVE', lang) || 'Exclusivo'}: **${exclusiveText}**`,
        }));
    },
};
