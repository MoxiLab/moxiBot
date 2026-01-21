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

const { PermissionsBitField: { Flags }, ContainerBuilder, MessageFlags } = require('discord.js');

function buildPanel({ title, body }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body));

    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function parseChannelId(message, raw) {
    const mentioned = message.mentions?.channels?.first?.();
    if (mentioned?.id) return mentioned.id;
    if (!raw) return '';
    const id = String(raw).replace(/[<#>]/g, '').trim();
    return /^\d{15,30}$/.test(id) ? id : '';
}

module.exports = {
    name: 'economy',
    alias: ['eco', 'economyconfig', 'econconfig'],
    description: (lang = 'es-ES') => moxi.translate('misc:ECONOMY_ADMIN_DESC', lang) || 'Configura la economía (toggle y canal)',
    usage: 'economy on | economy off | economy set #canal | economy clear | economy exclusive on/off | economy status',
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_ADMIN', lang),
    permissions: { User: [Flags.Administrator] },
    cooldown: 5,

    async execute(Moxi, message, args) {
        const guildId = message.guild?.id || 'dm';
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const sub = (args[0] || 'status').toLowerCase();

        if (!message.guild) {
            return message.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.cross} ${moxi.translate('GUILD_ONLY', lang) || 'Solo en servidores.'}`,
            }));
        }

        if (sub === 'on' || sub === 'enable') {
            await setGuildEconomyEnabled(guildId, true);
            invalidateGuildSettingsCache(guildId);
            return message.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.tick} ${moxi.translate('misc:ECONOMY_ADMIN_ENABLED', lang) || 'Economía activada.'}`,
            }));
        }

        if (sub === 'off' || sub === 'disable') {
            await setGuildEconomyEnabled(guildId, false);
            invalidateGuildSettingsCache(guildId);
            return message.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.tick} ${moxi.translate('misc:ECONOMY_ADMIN_DISABLED', lang) || 'Economía desactivada.'}`,
            }));
        }

        if (sub === 'set') {
            const channelId = parseChannelId(message, args[1]);
            const ch = channelId
                ? (message.guild.channels.cache.get(channelId) || await message.guild.channels.fetch(channelId).catch(() => null))
                : null;

            if (!ch) {
                return message.reply(buildPanel({
                    title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                    body: `${EMOJIS.cross} ${(moxi.translate('misc:ECONOMY_ADMIN_USAGE', lang) || 'Uso')}: ${this.usage}`,
                }));
            }

            await setGuildEconomyChannel(guildId, ch.id);
            invalidateGuildSettingsCache(guildId);
            return message.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.tick} ${moxi.translate('misc:ECONOMY_ADMIN_CHANNEL_SET', lang, { channel: `<#${ch.id}>` }) || `Canal de economía: <#${ch.id}>`}`,
            }));
        }

        if (sub === 'clear' || sub === 'unset' || sub === 'remove') {
            await setGuildEconomyChannel(guildId, null);
            invalidateGuildSettingsCache(guildId);
            return message.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.tick} ${moxi.translate('misc:ECONOMY_ADMIN_CHANNEL_CLEARED', lang) || 'Restricción de canal eliminada.'}`,
            }));
        }

        if (sub === 'exclusive' || sub === 'solo') {
            const v = (args[1] || '').toLowerCase();
            const enabled = (v === 'on' || v === 'true' || v === 'si' || v === 'sí' || v === '1' || v === 'enable');
            const disabled = (v === 'off' || v === 'false' || v === 'no' || v === '0' || v === 'disable');
            if (!enabled && !disabled) {
                return message.reply(buildPanel({
                    title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                    body: `${EMOJIS.cross} ${(moxi.translate('misc:ECONOMY_ADMIN_USAGE', lang) || 'Uso')}: economy exclusive on/off`,
                }));
            }

            await setGuildEconomyExclusive(guildId, enabled);
            invalidateGuildSettingsCache(guildId);
            return message.reply(buildPanel({
                title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
                body: `${EMOJIS.tick} ${enabled
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

        return message.reply(buildPanel({
            title: moxi.translate('misc:ECONOMY_ADMIN_TITLE', lang) || 'Economía',
            body: `${EMOJIS.info || ''} ${moxi.translate('misc:ECONOMY_ADMIN_STATUS_TITLE', lang) || 'Estado'}: **${enabledText}**\n` +
                `${EMOJIS.channel || ''} ${moxi.translate('misc:ECONOMY_ADMIN_STATUS_CHANNEL', lang) || 'Canal'}: ${channelText}\n` +
                `${EMOJIS.lock || ''} ${moxi.translate('misc:ECONOMY_ADMIN_STATUS_EXCLUSIVE', lang) || 'Exclusivo'}: **${exclusiveText}**`,
        }));
    },
};
