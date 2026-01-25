const { PermissionsBitField: { Flags }, ApplicationCommandOptionType, ContainerBuilder, MessageFlags } = require('discord.js');
const BonusSystem = require('../../Global/Helpers/BonusSystem');
const { Bot } = require('../../Config');
const debugHelper = require('../../Util/debugHelper');

function toHexColor(color, fallback = '#ffb6e6') {
    if (typeof color === 'number' && Number.isFinite(color)) {
        return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
    }

    const raw = String(color || '').trim();
    if (!raw) return fallback;

    if (raw.startsWith('#') && raw.length === 7) return raw.toLowerCase();
    if (raw.startsWith('0x')) return `#${raw.slice(2).padStart(6, '0').toLowerCase()}`;

    const hex = raw.startsWith('#') ? raw.slice(1) : raw;
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;

    return fallback;
}

async function getUserBannerUrl(client, userId) {
    if (!client?.users?.fetch) return null;
    const fetched = await client.users.fetch(userId, { force: true }).catch(() => null);
    return fetched?.bannerURL?.({ size: 2048, extension: 'png' })
        || fetched?.bannerURL?.({ size: 2048, extension: 'jpg' })
        || null;
}

module.exports = {
    name: 'levelconfig',
    alias: ['levelconfig-admin', 'config-level'],
    description: 'Configura el sistema de niveles del servidor',
    usage: 'levelconfig set <#canal> | levelconfig notificaciones <si/no> [#canal] | levelconfig xp <minimo> <maximo> <cooldown_seg> | levelconfig prestige <si/no> [nivel] | levelconfig dailybonus <si/no> [xp] | levelconfig reaccionbonus <si/no> [xp] | levelconfig canal_bloqueado <#canal> <si/no> | levelconfig preview',
    helpText: () => (
        'Configura la XP y las notificaciones de subida de nivel.\n' +
        'Atajo recomendado: `levelconfig set #canal` (activa notificaciones y fija el canal).'
    ),
    examples: [
        'levelconfig set #niveles',
        'levelconfig notificaciones si #niveles',
        'levelconfig notificaciones no',
        'levelconfig xp 5 15 60',
    ],
    category: 'Admin',
    cooldown: 5,

    permissions: {
        user: [Flags.Administrator],
        bot: [Flags.SendMessages],
        role: []
    },

    command: {
        prefix: true,
        slash: true,
        ephemeral: false,
        options: [
            {
                name: 'xp',
                description: 'Configura XP por mensaje',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'minimo',
                        description: 'XP mínimo por mensaje',
                        type: ApplicationCommandOptionType.Integer,
                        min_value: 1,
                        required: true
                    },
                    {
                        name: 'maximo',
                        description: 'XP máximo por mensaje',
                        type: ApplicationCommandOptionType.Integer,
                        min_value: 1,
                        required: true
                    },
                    {
                        name: 'cooldown',
                        description: 'Cooldown en segundos',
                        type: ApplicationCommandOptionType.Integer,
                        min_value: 1,
                        required: true
                    }
                ]
            },
            {
                name: 'prestige',
                description: 'Configura el sistema de prestige',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'habilitado',
                        description: '¿Habilitar prestige?',
                        type: ApplicationCommandOptionType.Boolean,
                        required: true
                    },
                    {
                        name: 'nivel_requerido',
                        description: 'Nivel para hacer prestige',
                        type: ApplicationCommandOptionType.Integer,
                        min_value: 1,
                        required: false
                    }
                ]
            },
            {
                name: 'dailybonus',
                description: 'Configura bonus diario',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'habilitado',
                        description: '¿Habilitar bonus diario?',
                        type: ApplicationCommandOptionType.Boolean,
                        required: true
                    },
                    {
                        name: 'xp',
                        description: 'XP del bonus',
                        type: ApplicationCommandOptionType.Integer,
                        min_value: 1,
                        required: false
                    }
                ]
            },
            {
                name: 'reaccionbonus',
                description: 'Configura bonus por reacciones',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'habilitado',
                        description: '¿Habilitar bonus de reacciones?',
                        type: ApplicationCommandOptionType.Boolean,
                        required: true
                    },
                    {
                        name: 'xp_por_reaccion',
                        description: 'XP por reacción',
                        type: ApplicationCommandOptionType.Integer,
                        min_value: 1,
                        required: false
                    }
                ]
            },
            {
                name: 'notificaciones',
                description: 'Configura notificaciones de level-up',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'habilitado',
                        description: '¿Habilitar notificaciones?',
                        type: ApplicationCommandOptionType.Boolean,
                        required: true
                    },
                    {
                        name: 'canal',
                        description: 'Canal para notificaciones',
                        type: ApplicationCommandOptionType.Channel,
                        required: false
                    }
                ]
            },
            {
                name: 'canal_bloqueado',
                description: 'Bloquea/desbloquea un canal para XP',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'canal',
                        description: 'Canal a bloquear',
                        type: ApplicationCommandOptionType.Channel,
                        required: true
                    },
                    {
                        name: 'bloquear',
                        description: '¿Bloquear o desbloquear?',
                        type: ApplicationCommandOptionType.Boolean,
                        required: true
                    }
                ]
            },
            {
                name: 'preview',
                description: 'Muestra una vista previa de la tarjeta de level-up',
                type: ApplicationCommandOptionType.Subcommand
            }
        ]
    },

    execute: async (Moxi, message, args) => {
        try {
            const guildID = message.guildId;
            const subcommand = (args[0] || '').toLowerCase();

            debugHelper.log('levelconfig', 'execute start', {
                guildId: guildID || 'dm',
                userId: message.author?.id,
                subcommand: subcommand || null,
                argsPreview: Array.isArray(args) ? args.slice(0, 6) : [],
            });

            const usageLines = [
                '**Uso:**',
                '`levelconfig set <#canal>`',
                '`levelconfig xp <minimo> <maximo> <cooldown_seg>`',
                '`levelconfig prestige <si/no> [nivel_requerido]`',
                '`levelconfig dailybonus <si/no> [xp]`',
                '`levelconfig reaccionbonus <si/no> [xp_por_reaccion]`',
                '`levelconfig notificaciones <si/no> [#canal]`',
                '`levelconfig canal_bloqueado <#canal> <si/no>`',
                '`levelconfig preview`',
            ].join('\n');

            const parseBoolean = (input) => {
                if (input === undefined || input === null) return null;
                const v = String(input).trim().toLowerCase();
                if (!v) return null;
                const truthy = new Set(['1', 'true', 't', 'yes', 'y', 'si', 'sí', 'on', 'enable', 'enabled', 'habilitar', 'habilitado']);
                const falsy = new Set(['0', 'false', 'f', 'no', 'n', 'off', 'disable', 'disabled', 'deshabilitar', 'deshabilitado']);
                if (truthy.has(v)) return true;
                if (falsy.has(v)) return false;
                return null;
            };

            const parseIntStrict = (input) => {
                if (input === undefined || input === null) return null;
                const n = parseInt(String(input), 10);
                return Number.isFinite(n) ? n : null;
            };

            const replyPanel = async (title, body) => {
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(title))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(body));
                return message.reply({
                    content: '',
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false }
                });
            };

            if (!subcommand) {
                return replyPanel('# ⚙️ Configuración de niveles', usageLines);
            }

            let config = await BonusSystem.getConfig(guildID);
            const updates = {};

            if (subcommand === 'set') {
                const mentioned = message.mentions.channels.first();
                const channelIdArg = args[1] ? String(args[1]).replace(/[<#>]/g, '') : null;
                const fallbackChannel = channelIdArg
                    ? (message.guild?.channels?.cache?.get(channelIdArg) || null)
                    : null;
                const notifChannel = mentioned || fallbackChannel;

                if (!notifChannel) {
                    return replyPanel('# ❌ Argumentos inválidos', `${usageLines}\n\nEjemplo: \`levelconfig set #niveles\``);
                }

                updates.levelUpNotifications = {
                    enabled: true,
                    channel: notifChannel.id,
                    message: '🎉 ¡{user} ha subido al nivel {level}!'
                };

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'set notifications channel (prefix)', { guildId: guildID, channel: notifChannel.id });
                return replyPanel('# ✅ Configuración actualizada', `Notificaciones de level-up: **habilitadas**\nCanal: ${notifChannel}`);
            } else if (subcommand === 'preview') {
                const { LevelUp } = require('canvafy');
                const { AttachmentBuilder } = require('discord.js');
                const LevelSystem = require('../../Global/Helpers/LevelSystem');
                const accentHex = toHexColor(Bot?.AccentColor);
                const bannerUrl = await getUserBannerUrl(message.client, message.author.id);

                const userInfo = await LevelSystem.getUserLevelInfo(message.guildId, message.author.id);
                if (!userInfo) {
                    debugHelper.warn('levelconfig', 'preview missing data (prefix)', { guildId: guildID, userId: message.author?.id });
                    return replyPanel('# ❌ Sin datos', 'No se encontraron datos de nivel para este usuario.');
                }

                const card = await new LevelUp()
                    .setAvatar(message.author.displayAvatarURL({ extension: 'png' }))
                    .setBackground(bannerUrl ? 'image' : 'color', bannerUrl || '#23272a')
                    .setUsername(message.author.username)
                    .setBorder(accentHex)
                    .setAvatarBorder(accentHex)
                    .setOverlayOpacity(0.7)
                    .setLevels(userInfo.level > 1 ? userInfo.level - 1 : 1, userInfo.level)
                    .build();

                const attachment = new AttachmentBuilder(card, { name: 'levelup.png' });
                return message.reply({
                    content: '🖼️ Vista previa de la tarjeta de level-up:',
                    files: [attachment],
                    allowedMentions: { repliedUser: false }
                });
            } else if (subcommand === 'xp') {
                const minXp = parseIntStrict(args[1]);
                const maxXp = parseIntStrict(args[2]);
                const cooldown = parseIntStrict(args[3]);

                if (!minXp || !maxXp || !cooldown) {
                    return replyPanel('# ❌ Argumentos inválidos', `${usageLines}\n\nEjemplo: \`levelconfig xp 5 15 60\``);
                }
                if (minXp < 1 || maxXp < 1 || cooldown < 1) {
                    return replyPanel('# ❌ Argumentos inválidos', 'Los valores deben ser números enteros mayores o iguales a 1.');
                }
                if (maxXp < minXp) {
                    return replyPanel('# ❌ Argumentos inválidos', 'El máximo no puede ser menor que el mínimo.');
                }

                updates.minXpPerMessage = minXp;
                updates.maxXpPerMessage = maxXp;
                updates.xpCooldown = cooldown;

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'updated xp config (prefix)', { guildId: guildID, ...updates });
                return replyPanel('# ✅ Configuración actualizada', `XP por mensaje:\n- Mínimo: **${minXp}**\n- Máximo: **${maxXp}**\n- Cooldown: **${cooldown}s**`);
            } else if (subcommand === 'prestige') {
                const enabled = parseBoolean(args[1]);
                if (enabled === null) {
                    return replyPanel('# ❌ Argumentos inválidos', `${usageLines}\n\nEjemplo: \`levelconfig prestige si 50\``);
                }
                const levelRequired = parseIntStrict(args[2]) || 50;
                if (levelRequired < 1) {
                    return replyPanel('# ❌ Argumentos inválidos', 'El nivel requerido debe ser un entero >= 1.');
                }

                updates.prestigeEnabled = enabled;
                updates.levelRequiredForPrestige = levelRequired;

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'updated prestige config (prefix)', { guildId: guildID, ...updates });
                return replyPanel('# ✅ Configuración actualizada', `Prestige: **${enabled ? 'habilitado' : 'deshabilitado'}**${enabled ? `\nNivel requerido: **${levelRequired}**` : ''}`);
            } else if (subcommand === 'dailybonus') {
                const enabled = parseBoolean(args[1]);
                if (enabled === null) {
                    return replyPanel('# ❌ Argumentos inválidos', `${usageLines}\n\nEjemplo: \`levelconfig dailybonus si 100\``);
                }
                const xp = parseIntStrict(args[2]) || 100;
                if (xp < 1) {
                    return replyPanel('# ❌ Argumentos inválidos', 'La XP del bonus debe ser un entero >= 1.');
                }

                updates.dailyBonusEnabled = enabled;
                updates.dailyBonusXp = xp;

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'updated daily bonus (prefix)', { guildId: guildID, ...updates });
                return replyPanel('# ✅ Configuración actualizada', `Bonus diario: **${enabled ? 'habilitado' : 'deshabilitado'}**${enabled ? `\nXP: **${xp}**` : ''}`);
            } else if (subcommand === 'reaccionbonus') {
                const enabled = parseBoolean(args[1]);
                if (enabled === null) {
                    return replyPanel('# ❌ Argumentos inválidos', `${usageLines}\n\nEjemplo: \`levelconfig reaccionbonus si 5\``);
                }
                const xp = parseIntStrict(args[2]) || 5;
                if (xp < 1) {
                    return replyPanel('# ❌ Argumentos inválidos', 'La XP por reacción debe ser un entero >= 1.');
                }

                updates.reactionBonusEnabled = enabled;
                updates.xpPerReaction = xp;

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'updated reaction bonus (prefix)', { guildId: guildID, ...updates });
                return replyPanel('# ✅ Configuración actualizada', `Bonus de reacciones: **${enabled ? 'habilitado' : 'deshabilitado'}**${enabled ? `\nXP por reacción: **${xp}**` : ''}`);
            } else if (subcommand === 'notificaciones') {
                const enabled = parseBoolean(args[1]);
                if (enabled === null) {
                    return replyPanel('# ❌ Argumentos inválidos', `${usageLines}\n\nEjemplo: \`levelconfig notificaciones si #canal\``);
                }

                const mentioned = message.mentions.channels.first();
                const channelIdArg = args[2] ? String(args[2]).replace(/[<#>]/g, '') : null;
                const fallbackChannel = channelIdArg
                    ? (message.guild?.channels?.cache?.get(channelIdArg) || null)
                    : null;
                const notifChannel = mentioned || fallbackChannel;

                updates.levelUpNotifications = {
                    enabled,
                    channel: notifChannel?.id || null,
                    message: '🎉 ¡{user} ha subido al nivel {level}!'
                };

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'updated notifications (prefix)', { guildId: guildID, enabled, channel: notifChannel?.id || null });
                return replyPanel('# ✅ Configuración actualizada', `Notificaciones: **${enabled ? 'habilitadas' : 'deshabilitadas'}**${notifChannel ? `\nCanal: ${notifChannel}` : ''}`);
            } else if (subcommand === 'canal_bloqueado') {
                const mentioned = message.mentions.channels.first();
                const channelIdArg = args[1] ? String(args[1]).replace(/[<#>]/g, '') : null;
                const targetChannel = mentioned || (channelIdArg ? (message.guild?.channels?.cache?.get(channelIdArg) || null) : null);
                const block = parseBoolean(args[2]);

                if (!targetChannel || block === null) {
                    return replyPanel('# ❌ Argumentos inválidos', `${usageLines}\n\nEjemplo: \`levelconfig canal_bloqueado #general si\``);
                }

                if (!config.blockedChannels) config.blockedChannels = [];

                if (block && !config.blockedChannels.includes(targetChannel.id)) {
                    config.blockedChannels.push(targetChannel.id);
                } else if (!block && config.blockedChannels.includes(targetChannel.id)) {
                    config.blockedChannels = config.blockedChannels.filter(id => id !== targetChannel.id);
                }

                await BonusSystem.updateConfig(guildID, { blockedChannels: config.blockedChannels });
                debugHelper.log('levelconfig', 'updated blocked channel (prefix)', { guildId: guildID, channel: targetChannel.id, blocked: block });
                return replyPanel('# ✅ Configuración actualizada', `Canal ${targetChannel} **${block ? 'bloqueado' : 'desbloqueado'}** para XP.`);
            }

            debugHelper.warn('levelconfig', 'unknown subcommand (prefix)', { guildId: guildID, subcommand });
            return replyPanel('# ❌ Subcomando inválido', usageLines);

        } catch (error) {
            console.error('[LevelConfig Command] Error (prefix):', error);
            debugHelper.error('levelconfig', 'execute failure', { guildId: message.guildId || 'dm', userId: message.author?.id, error: error?.message || error });
            const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# ❌ Error al actualizar configuración.'));
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }
    },

    interactionRun: async (client, interaction) => {
        try {
            await interaction.deferReply();

            const guildID = interaction.guildId;
            const subcommand = interaction.options.getSubcommand();
            debugHelper.log('levelconfig', 'interaction start', {
                guildId: guildID || 'dm',
                userId: interaction.user?.id,
                subcommand,
                options: interaction.options.data?.map(opt => ({ name: opt.name, value: opt.value })) || [],
            });

            let config = await BonusSystem.getConfig(guildID);
            const updates = {};

            if (subcommand === 'preview') {
                const { LevelUp } = require('canvafy');
                const { AttachmentBuilder } = require('discord.js');
                const LevelSystem = require('../../Global/Helpers/LevelSystem');
                const accentHex = toHexColor(Bot?.AccentColor);
                const bannerUrl = await getUserBannerUrl(interaction.client, interaction.user.id);

                const userInfo = await LevelSystem.getUserLevelInfo(interaction.guildId, interaction.user.id);
                if (!userInfo) {
                    debugHelper.warn('levelconfig', 'preview missing data', { guildId: guildID, userId: interaction.user?.id });
                    return interaction.editReply({ content: '❌ No se encontraron datos de nivel para este usuario.' });
                }

                const card = await new LevelUp()
                    .setAvatar(interaction.user.displayAvatarURL({ extension: 'png' }))
                    .setBackground(bannerUrl ? 'image' : 'color', bannerUrl || '#23272a')
                    .setUsername(interaction.user.username)
                    .setBorder(accentHex)
                    .setAvatarBorder(accentHex)
                    .setOverlayOpacity(0.7)
                    .setLevels(userInfo.level > 1 ? userInfo.level - 1 : 1, userInfo.level)
                    .build();
                const attachment = new AttachmentBuilder(card, { name: 'levelup.png' });
                await interaction.editReply({
                    content: '🖼️ Vista previa de la tarjeta de level-up:',
                    files: [attachment]
                });

                debugHelper.log('levelconfig', 'preview success', { guildId: guildID, userId: interaction.user?.id });
                return;
            } else if (subcommand === 'xp') {
                const minXp = interaction.options.getInteger('minimo');
                const maxXp = interaction.options.getInteger('maximo');
                const cooldown = interaction.options.getInteger('cooldown');

                updates.minXpPerMessage = minXp;
                updates.maxXpPerMessage = maxXp;
                updates.xpCooldown = cooldown;

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'updated xp config', { guildId: guildID, ...updates });
                return interaction.editReply(
                    `✅ Configuración de XP actualizada:\n- Mínimo: ${minXp}\n- Máximo: ${maxXp}\n- Cooldown: ${cooldown}s`
                );
            } else if (subcommand === 'prestige') {
                const prestigeEnabled = interaction.options.getBoolean('habilitado');
                const levelRequired = interaction.options.getInteger('nivel_requerido') || 50;

                updates.prestigeEnabled = prestigeEnabled;
                updates.levelRequiredForPrestige = levelRequired;

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'updated prestige config', { guildId: guildID, ...updates });
                return interaction.editReply(
                    `✅ Prestige ${prestigeEnabled ? 'habilitado' : 'deshabilitado'}${prestigeEnabled ? ` (Nivel requerido: ${levelRequired})` : ''}`
                );
            } else if (subcommand === 'dailybonus') {
                const dailyEnabled = interaction.options.getBoolean('habilitado');
                const dailyXp = interaction.options.getInteger('xp') || 100;

                updates.dailyBonusEnabled = dailyEnabled;
                updates.dailyBonusXp = dailyXp;

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'updated daily bonus', { guildId: guildID, ...updates });
                return interaction.editReply(
                    `✅ Bonus diario ${dailyEnabled ? 'habilitado' : 'deshabilitado'}${dailyEnabled ? ` (${dailyXp} XP)` : ''}`
                );
            } else if (subcommand === 'reaccionbonus') {
                const reactionEnabled = interaction.options.getBoolean('habilitado');
                const reactionXp = interaction.options.getInteger('xp_por_reaccion') || 5;

                updates.reactionBonusEnabled = reactionEnabled;
                updates.xpPerReaction = reactionXp;

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'updated reaction bonus', { guildId: guildID, ...updates });
                return interaction.editReply(
                    `✅ Bonus de reacciones ${reactionEnabled ? 'habilitado' : 'deshabilitado'}${reactionEnabled ? ` (${reactionXp} XP por reacción)` : ''}`
                );
            } else if (subcommand === 'notificaciones') {
                const notifEnabled = interaction.options.getBoolean('habilitado');
                const notifChannel = interaction.options.getChannel('canal');

                updates.levelUpNotifications = {
                    enabled: notifEnabled,
                    channel: notifChannel?.id || null,
                    message: '🎉 ¡{user} ha subido al nivel {level}!'
                };

                await BonusSystem.updateConfig(guildID, updates);
                debugHelper.log('levelconfig', 'updated notifications', { guildId: guildID, notifEnabled, channel: notifChannel?.id });
                return interaction.editReply(
                    `✅ Notificaciones ${notifEnabled ? 'habilitadas' : 'deshabilitadas'}${notifChannel ? ` en ${notifChannel}` : ''}`
                );
            } else if (subcommand === 'canal_bloqueado') {
                const channel = interaction.options.getChannel('canal');
                const block = interaction.options.getBoolean('bloquear');

                if (!config.blockedChannels) config.blockedChannels = [];

                if (block && !config.blockedChannels.includes(channel.id)) {
                    config.blockedChannels.push(channel.id);
                } else if (!block && config.blockedChannels.includes(channel.id)) {
                    config.blockedChannels = config.blockedChannels.filter(id => id !== channel.id);
                }

                await BonusSystem.updateConfig(guildID, { blockedChannels: config.blockedChannels });
                debugHelper.log('levelconfig', 'updated blocked channel', { guildId: guildID, channel: channel.id, blocked: block });
                return interaction.editReply(
                    `✅ Canal ${channel} ${block ? 'bloqueado' : 'desbloqueado'}`
                );
            }

            debugHelper.warn('levelconfig', 'unknown subcommand', { guildId: guildID, subcommand });
            return interaction.editReply({ content: '❌ Subcomando inválido.' });
        } catch (error) {
            console.error('[LevelConfig Command] Error:', error);
            debugHelper.error('levelconfig', 'interaction failure', { guildId: interaction.guildId || 'dm', userId: interaction.user?.id, error: error?.message || error });
            const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# ❌ Error al actualizar configuración.'));
            return interaction.editReply({
                content: '',
                components: [container],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }
    }
};

