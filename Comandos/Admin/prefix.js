const { setGuildPrefix, invalidateGuildSettingsCache } = require('../../Util/guildSettings');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const debugHelper = require('../../Util/debugHelper');

const { PermissionsBitField: { Flags } } = require('discord.js');

module.exports = {
    name: 'prefix',
    alias: ['setprefix', 'prefix', 'sp'],
    description: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CMD_PREFIX_DESC', lang);
    },
    usage: 'prefix [nuevo prefijo]',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    permissions: {
        User: [Flags.Administrator],
    },
    cooldown: 10,
    async execute(Moxi, message, args) {
        debugHelper.log('prefix', 'execute start', {
            guildId: message.guild?.id || 'dm',
            userId: message.author?.id,
            argsCount: (args || []).length,
            preview: (args || []).slice(0, 2),
        });
        if (!args[0]) {
            const { ContainerBuilder, MessageFlags } = require('discord.js');
            const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const globalPrefix = (Array.isArray(Bot?.Prefix) && Bot.Prefix[0]) ? Bot.Prefix[0] : (process.env.PREFIX || '.');
            const currentPrefix = await moxi.guildPrefix(message.guild?.id, globalPrefix);

            const mentionPrefix = Moxi?.user?.id ? `<@${Moxi.user.id}>` : '';
            const alsoPrefixes = [
                '`moxi`',
                '`mx`',
                mentionPrefix
            ].filter(Boolean).join('  ');

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('prefix-panels:CURRENT_PREFIX_TITLE', lang)}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(moxi.translate('prefix-panels:CURRENT_PREFIX_DESC', lang, { prefix: currentPrefix })))
                .addTextDisplayComponents(c => c.setContent(moxi.translate('prefix-panels:ALSO_CAN_USE', lang, { prefixes: alsoPrefixes })))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }
        const newPrefix = args[0];
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        if (newPrefix.length > 20) {
            const { ContainerBuilder, MessageFlags } = require('discord.js');
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('prefix-panels:PREFIX_TOO_LONG_TITLE', lang)}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(moxi.translate('prefix-panels:PREFIX_TOO_LONG', lang)))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
            debugHelper.warn('prefix', 'new prefix too long', { guildId: message.guild?.id || 'dm', requested: newPrefix });
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }
        try {
            await setGuildPrefix(message.guild.id, newPrefix);
            invalidateGuildSettingsCache(message.guild.id);
            // Mantener settings en memoria coherentes (por si se usa inmediatamente)
            message.guild.settings = message.guild.settings || {};
            message.guild.settings.Prefix = [newPrefix];
            const { ContainerBuilder, MessageFlags } = require('discord.js');
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('prefix-panels:PREFIX_SUCCESS_TITLE', lang)}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(moxi.translate('prefix-panels:PREFIX_SUCCESS', lang, { prefix: newPrefix })))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
            debugHelper.log('prefix', 'prefix set', { guildId: message.guild?.id || 'dm', newPrefix });
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }
        catch (e) {
            console.error('Error setting guild prefix:', e);
            debugHelper.error('prefix', 'prefix set failed', { guildId: message.guild?.id || 'dm', error: e?.message || e });
            const { ContainerBuilder, MessageFlags } = require('discord.js');
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('prefix-panels:PREFIX_ERROR_TITLE', lang)}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(moxi.translate('prefix-panels:PREFIX_ERROR', lang)))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }
    }
};
