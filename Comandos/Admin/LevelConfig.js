const { PermissionsBitField: { Flags }, ApplicationCommandOptionType, ContainerBuilder, MessageFlags } = require('discord.js');
const BonusSystem = require('../../Global/Helpers/BonusSystem');
const { Bot } = require('../../Config');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'levelconfig',
    alias: ['levelconfig-admin', 'config-level'],
    description: 'Configura el sistema de niveles del servidor',
    usage: 'levelconfig [subcomando]',
    category: 'Admin',
    cooldown: 5,

    permissions: {
        user: [Flags.Administrator],
        bot: [Flags.SendMessages],
        role: []
    },

    command: {
        prefix: false,
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
        const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c => c.setContent('# ❌ Este comando solo funciona con slash commands.'));
        return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
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

            switch (subcommand) {
                case 'preview': {
                    const { LevelUp } = require('canvafy');
                    const { AttachmentBuilder } = require('discord.js');
                    const LevelSystem = require('../../Global/Helpers/LevelSystem');

                    const userInfo = await LevelSystem.getUserLevelInfo(interaction.guildId, interaction.user.id);
                    if (!userInfo) {
                        debugHelper.warn('levelconfig', 'preview missing data', { guildId: guildID, userId: interaction.user?.id });
                        return interaction.editReply({ content: '❌ No se encontraron datos de nivel para este usuario.' });
                    }

                    const card = await new LevelUp()
                        .setAvatar(interaction.user.displayAvatarURL({ extension: 'png' }))
                        .setBackground('color', '#23272a')
                        .setUsername(interaction.user.username)
                        .setBorder('#000000')
                        .setAvatarBorder('#ff0000')
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
                }
                case 'xp': {
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
                }
                case 'prestige': {
                    const prestigeEnabled = interaction.options.getBoolean('habilitado');
                    const levelRequired = interaction.options.getInteger('nivel_requerido') || 50;

                    updates.prestigeEnabled = prestigeEnabled;
                    updates.levelRequiredForPrestige = levelRequired;

                    await BonusSystem.updateConfig(guildID, updates);
                    debugHelper.log('levelconfig', 'updated prestige config', { guildId: guildID, ...updates });
                    return interaction.editReply(
                        `✅ Prestige ${prestigeEnabled ? 'habilitado' : 'deshabilitado'}${prestigeEnabled ? ` (Nivel requerido: ${levelRequired})` : ''}`
                    );
                }
                case 'dailybonus': {
                    const dailyEnabled = interaction.options.getBoolean('habilitado');
                    const dailyXp = interaction.options.getInteger('xp') || 100;

                    updates.dailyBonusEnabled = dailyEnabled;
                    updates.dailyBonusXp = dailyXp;

                    await BonusSystem.updateConfig(guildID, updates);
                    debugHelper.log('levelconfig', 'updated daily bonus', { guildId: guildID, ...updates });
                    return interaction.editReply(
                        `✅ Bonus diario ${dailyEnabled ? 'habilitado' : 'deshabilitado'}${dailyEnabled ? ` (${dailyXp} XP)` : ''}`
                    );
                }
                case 'reaccionbonus': {
                    const reactionEnabled = interaction.options.getBoolean('habilitado');
                    const reactionXp = interaction.options.getInteger('xp_por_reaccion') || 5;

                    updates.reactionBonusEnabled = reactionEnabled;
                    updates.xpPerReaction = reactionXp;

                    await BonusSystem.updateConfig(guildID, updates);
                    debugHelper.log('levelconfig', 'updated reaction bonus', { guildId: guildID, ...updates });
                    return interaction.editReply(
                        `✅ Bonus de reacciones ${reactionEnabled ? 'habilitado' : 'deshabilitado'}${reactionEnabled ? ` (${reactionXp} XP por reacción)` : ''}`
                    );
                }
                case 'notificaciones': {
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
                }
                case 'canal_bloqueado': {
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
                default:
                    debugHelper.warn('levelconfig', 'unknown subcommand', { guildId: guildID, subcommand });
                    return interaction.editReply({ content: '❌ Subcomando inválido.' });
            }
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

