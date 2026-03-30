const { setGuildPrefix, invalidateGuildSettingsCache } = require('../../Util/guildSettings');
const { getUserPrefix, setUserPrefix, clearUserPrefix } = require('../../Util/userPrefix');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const debugHelper = require('../../Util/debugHelper');

const {
    PermissionsBitField: { Flags },
    ContainerBuilder,
    MessageFlags,
    ButtonStyle,
    ActionRowBuilder,
} = require('discord.js');

module.exports = {
    name: 'prefix',
    alias: ['setprefix', 'prefix', 'sp'], 
    description: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CMD_PREFIX_DESC', lang);
    },
    usage: 'prefix [user|server] [nuevo prefijo|reset]',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    permissions: {
        User: [],
    },
    cooldown: 10,
    async execute(Moxi, message, args) {
        const strictEnvPrefix = ['1', 'true', 'yes', 'on'].includes(String(process.env.STRICT_ENV_PREFIX || '0').trim().toLowerCase());
        const envPrefix = (typeof process.env.PREFIX === 'string' && process.env.PREFIX.trim())
            ? process.env.PREFIX.trim()
            : ((Array.isArray(Bot?.Prefix) && Bot.Prefix[0]) ? Bot.Prefix[0] : '.');

        debugHelper.log('prefix', 'execute start', {
            guildId: message.guild?.id || 'dm',
            userId: message.author?.id,
            argsCount: (args || []).length,
            preview: (args || []).slice(0, 2),
        });

        if (strictEnvPrefix) {
            const { ContainerBuilder, MessageFlags } = require('discord.js');
            const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# Prefijo bloqueado por configuración'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`El bot está en modo de prefijo estricto (env).\nPrefijo activo: \`${envPrefix}\``))
                .addTextDisplayComponents(c => c.setContent('Para cambiarlo, edita `PREFIX` en el `.env` y reinicia el bot.'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        const scopeToken = String(args?.[0] || '').trim().toLowerCase();
        const isUserScope = ['user', 'usuario', 'u'].includes(scopeToken);
        const isServerScope = ['server', 'servidor', 'guild', 'global', 's'].includes(scopeToken);

        if (!args[0]) {
            const { ContainerBuilder, MessageFlags } = require('discord.js');
            const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const globalPrefix = (Array.isArray(Bot?.Prefix) && Bot.Prefix[0]) ? Bot.Prefix[0] : (process.env.PREFIX || '.');
            const currentServerPrefix = await moxi.guildPrefix(message.guild?.id, globalPrefix);
            const currentUserPrefix = await getUserPrefix(message.guild?.id, message.author?.id, '').catch(() => '');
            const currentPrefix = currentUserPrefix || currentServerPrefix;

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

        // Modo usuario: cualquier usuario puede tener su prefijo personal.
        if (isUserScope) {
            const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const action = String(args?.[1] || '').trim();

            if (!action) {
                const presets = [
                    { key: 'dot', label: '.', value: '.' },
                    { key: 'bang', label: '!', value: '!' },
                    { key: 'question', label: '?', value: '?' },
                    { key: 'dollar', label: '$', value: '$' },
                    { key: 'hash', label: '#', value: '#' },
                ];

                const buildUserPanel = (currentUserPrefix, disabled = false) => {
                    const container = new ContainerBuilder()
                        .setAccentColor(Bot.AccentColor)
                        .addTextDisplayComponents(c => c.setContent('# Prefijo personal'))
                        .addSeparatorComponents(s => s.setDivider(true))
                        .addTextDisplayComponents(c => c.setContent(currentUserPrefix
                            ? `Tu prefijo personal actual es: **\`${currentUserPrefix}\`**`
                            : 'No tienes prefijo personal configurado (usas el del servidor).'))
                        .addTextDisplayComponents(c => c.setContent('Selecciona un botón para cambiarlo rápido.'))
                        .addSeparatorComponents(s => s.setDivider(true))
                        .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));

                    const quickRow = new ActionRowBuilder().addComponents(
                        ...presets.map((p) => new ButtonBuilder()
                            .setCustomId(`prefix_user_set_${p.key}`)
                            .setLabel(p.label)
                            .setStyle(currentUserPrefix === p.value ? ButtonStyle.Success : ButtonStyle.Primary)
                            .setDisabled(disabled)
                        )
                    );

                    const actionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('prefix_user_reset')
                            .setLabel('Reset')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(disabled),
                        new ButtonBuilder()
                            .setCustomId('prefix_user_close')
                            .setLabel('Cerrar')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(disabled)
                    );

                    return { container, quickRow, actionRow };
                };

                let currentUserPrefix = await getUserPrefix(message.guild?.id, message.author?.id, '').catch(() => '');
                const initial = buildUserPanel(currentUserPrefix, false);
                const panelMsg = await message.reply({
                    content: '',
                    components: [initial.container, initial.quickRow, initial.actionRow],
                    flags: MessageFlags.IsComponentsV2,
                });

                const collector = panelMsg.createMessageComponentCollector({
                    filter: (i) => i.user?.id === message.author?.id && i.customId.startsWith('prefix_user_'),
                    time: 3 * 60 * 1000,
                });

                collector.on('collect', async (i) => {
                    try {
                        if (i.customId === 'prefix_user_close') {
                            collector.stop('closed');
                            const closed = buildUserPanel(currentUserPrefix, true);
                            return i.update({
                                components: [closed.container, closed.quickRow, closed.actionRow],
                                flags: MessageFlags.IsComponentsV2,
                            }).catch(() => null);
                        }

                        if (i.customId === 'prefix_user_reset') {
                            await clearUserPrefix(message.guild?.id, message.author?.id).catch(() => false);
                            currentUserPrefix = '';
                        } else {
                            const key = i.customId.replace('prefix_user_set_', '');
                            const found = presets.find((p) => p.key === key);
                            if (!found) return i.deferUpdate().catch(() => null);
                            const ok = await setUserPrefix(message.guild?.id, message.author?.id, found.value);
                            if (!ok) {
                                return i.reply({
                                    content: 'No se pudo guardar tu prefijo personal.',
                                    flags: MessageFlags.Ephemeral,
                                }).catch(() => null);
                            }
                            currentUserPrefix = found.value;
                        }

                        const updated = buildUserPanel(currentUserPrefix, false);
                        await i.update({
                            components: [updated.container, updated.quickRow, updated.actionRow],
                            flags: MessageFlags.IsComponentsV2,
                        }).catch(() => null);

                        return i.followUp({
                            content: currentUserPrefix
                                ? `Tu prefijo personal ahora es **\`${currentUserPrefix}\`**.`
                                : 'Tu prefijo personal fue eliminado. Ahora usas el del servidor.',
                            flags: MessageFlags.Ephemeral,
                        }).catch(() => null);
                    } catch (err) {
                        return i.reply({
                            content: 'Ocurrio un error procesando tu seleccion.',
                            flags: MessageFlags.Ephemeral,
                        }).catch(() => null);
                    }
                });

                collector.on('end', async () => {
                    try {
                        const disabled = buildUserPanel(currentUserPrefix, true);
                        await panelMsg.edit({
                            components: [disabled.container, disabled.quickRow, disabled.actionRow],
                            flags: MessageFlags.IsComponentsV2,
                        }).catch(() => null);
                    } catch {
                        // ignore
                    }
                });

                return;
            }

            if (['reset', 'clear', 'off', 'none', 'default'].includes(action.toLowerCase())) {
                await clearUserPrefix(message.guild?.id, message.author?.id).catch(() => false);
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent('# Prefijo personal eliminado'))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent('Ahora usaras el prefijo del servidor.'))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            const newUserPrefix = action;
            if (newUserPrefix.length > 20) {
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('prefix-panels:PREFIX_TOO_LONG_TITLE', lang)}`))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(moxi.translate('prefix-panels:PREFIX_TOO_LONG', lang)))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            const ok = await setUserPrefix(message.guild?.id, message.author?.id, newUserPrefix);
            if (!ok) {
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent('# Error al guardar tu prefijo personal'))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent('Intenta nuevamente en unos segundos.'))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
            }

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# Prefijo personal actualizado'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`Tu prefijo personal ahora es: **\`${newUserPrefix}\`**`))
                .addTextDisplayComponents(c => c.setContent('Solo te afecta a ti; el servidor mantiene su prefijo global.'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        const newPrefix = isServerScope ? args[1] : args[0];
        const isAdmin = message.member?.permissions?.has?.(Flags.Administrator, true);
        if (!isAdmin) {
            const { ContainerBuilder, MessageFlags } = require('discord.js');
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# Permisos insuficientes'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent('Solo admins pueden cambiar el prefijo del servidor.'))
                .addTextDisplayComponents(c => c.setContent('Si quieres uno personal usa: `prefix user <prefijo>`'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        if (!newPrefix) {
            const { ContainerBuilder, MessageFlags } = require('discord.js');
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# Uso del comando'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent('Servidor: `prefix server <prefijo>`'))
                .addTextDisplayComponents(c => c.setContent('Usuario: `prefix user <prefijo>`'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }

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
