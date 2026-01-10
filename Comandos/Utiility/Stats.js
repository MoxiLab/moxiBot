const { PermissionsBitField: { Flags }, ApplicationCommandOptionType, ContainerBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moxi = require('../../i18n');
const LevelSystem = require('../../Global/Helpers/LevelSystem');
const { Bot } = require('../../Config');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'stats',
    alias: ['estadisticas', 'profile', 'información'],
    description: (lang = 'es-ES') => moxi.translate('commands:CMD_STATS_DESC', lang) || 'Muestra estadísticas detalladas de un usuario',
    usage: 'stats [usuario]',
    category: function (lang) { return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang); },
    cooldown: 5,

    permissions: {
        User: [],
        Bot: [Flags.SendMessages],
        Role: []
    },

    command: {
        prefix: true,
        slash: true,
        ephemeral: false,
        options: [
            {
                name: 'usuario',
                description: (lang = 'es-ES') => moxi.translate('commands:CMD_STATS_USER_OPTION', lang) || 'Usuario (opcional)',
                type: ApplicationCommandOptionType.User,
                required: false
            }
        ]
    },

    async execute(Moxi, message, args) {
        try {
            const language = message.guild?.settings?.Language || 'es-ES';
            const t = (key, vars = {}) => moxi.translate(`misc:${key}`, language, vars);
            const target = message.mentions.users.first() || await Moxi.users.fetch(args[0]).catch(() => null) || message.author;
            const guildID = message.guildId;
            const requesterId = message.author?.id;
            debugHelper.log('stats', 'command start', { guildID, requesterId, targetId: target.id });

            const stats = await LevelSystem.getUserStats(guildID, target.id);
            if (!stats) {
                debugHelper.warn('stats', 'no stats found', { guildID, requesterId, targetId: target.id });
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(`# ❌ ${t('LEVEL_NO_DATA', { user: target.username })}`));
                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
            }

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# 📊 ${t('LEVEL_CARD_TITLE', { user: target.username })}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    `⭐ **${t('LEVEL_LABEL')} / ${t('STATS_RANK')}**\n` +
                    `${t('LEVEL_LABEL')}: **${stats.level}** | ${t('LEVEL_PRESTIGE')}: **${stats.prestige}** | ${t('STATS_POSITION')}: **#${stats.rank}**\n\n` +
                    `💎 **${t('STATS_EXPERIENCE')}**\n` +
                    `${t('LEVEL_XP')}: **${stats.totalXp.toLocaleString()}** | ${t('STATS_LEVEL_UPS')}: **${stats.levelUps}** | ${t('STATS_BONUS_XP')}: **${stats.bonusXp.toLocaleString()}**\n\n` +
                    `💬 **${t('STATS_ACTIVITY')}**\n` +
                    `${t('STATS_MESSAGES')}: **${stats.messages.toLocaleString()}** | ${t('STATS_REACTIONS')}: **${stats.reactions}** | ${t('STATS_STREAK')}: **${stats.streak} ${t('STATS_DAYS')}**\n\n` +
                    `🏆 **${t('STATS_ACHIEVEMENTS')}**\n` +
                    `${t('STATS_BADGES')}: **${stats.badges}** | ${t('STATS_MAX_STREAK')}: **${stats.maxStreak} ${t('STATS_DAYS')}** | ${t('LEVEL_PRESTIGE')}: **${stats.prestige}**\n\n` +
                    `📅 **${t('STATS_INFO')}**\n` +
                    `${t('STATS_MEMBER_SINCE')}: <t:${Math.floor(stats.joinedAt.getTime() / 1000)}:R>`
                ));
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('stats_refresh').setLabel(t('LEVEL_REFRESH')).setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('stats_close').setLabel(t('LEVEL_CLOSE')).setStyle(ButtonStyle.Secondary)
            );
            container.addActionRowComponents(row);
            debugHelper.log('stats', 'command replied', { guildID, requesterId, targetId: target.id });
            await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });

        } catch (error) {
            debugHelper.error('stats', 'command error', { guildID: message.guildId, requesterId: message.author?.id, error: error.message });
            const language = message.guild?.settings?.Language || 'es-ES';
            const t = (key, vars = {}) => moxi.translate(`misc:${key}`, language, vars);
            message.reply({
                content: t('STATS_ERROR_FETCH'),
                allowedMentions: { repliedUser: false }
            });
        }
    }
};

