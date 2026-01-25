const { PermissionsBitField: { Flags }, ApplicationCommandOptionType, ContainerBuilder, MessageFlags, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const LevelSystem = require('../../Global/Helpers/LevelSystem');
const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'levels',
    alias: ['leaderboard', 'top', 'rankings'],
    description: 'Muestra el leaderboard de niveles',
    usage: 'levels [tipo]',
    category: 'Utility',
    cooldown: 5,

    permissions: {
        user: [],
        bot: [Flags.SendMessages],
        role: []
    },

    command: {
        prefix: true,
        slash: true,
        ephemeral: false,
        options: [
            {
                name: 'tipo',
                description: 'Tipo de leaderboard',
                type: ApplicationCommandOptionType.String,
                choices: [
                    { name: '⭐ Por Nivel', value: 'level' },
                    { name: '💎 Por XP Total', value: 'xp' },
                    { name: '👑 Por Prestige', value: 'prestige' },
                    { name: '💬 Por Mensajes', value: 'messages' }
                ],
                required: false
            }
        ]
    },

    async execute(Moxi, message, args) {
        try {
            const language = message.guild?.settings?.Language || 'es-ES';
            const guildID = message.guildId;
            const requesterId = message.author?.id;
            const sortBy = args[0] || 'level';
            const t = (key, vars = {}) => moxi.translate(`misc:${key}`, language, vars);
            debugHelper.log('levels', 'command start', { guildID, requesterId, sortBy });

            const leaderboard = await LevelSystem.getLeaderboard(guildID, 10, sortBy);
            if (leaderboard.length === 0) {
                debugHelper.warn('levels', 'leaderboard empty', { guildID, requesterId, sortBy });
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(`# 📊 ${t('LEVELS_NO_USERS')}`));
                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
            }

            const medals = ['🥇', '🥈', '🥉'];
            let description = '━━━\n';
            for (let i = 0; i < leaderboard.length; i++) {
                const user = leaderboard[i];
                const medal = medals[i] || `${i + 1}.`;
                let info = '';
                if (sortBy === 'level') {
                    info = `**${t('LEVEL_LABEL')}:** ${user.level} | **${t('LEVEL_XP')}:** ${user.totalXp}`;
                } else if (sortBy === 'xp') {
                    info = `**${t('LEVEL_XP')}:** ${user.totalXp} | **${t('LEVEL_LABEL')}:** ${user.level}`;
                } else if (sortBy === 'prestige') {
                    info = `**${t('LEVEL_PRESTIGE')}:** ${user.prestige} | **${t('LEVEL_LABEL')}:** ${user.level}`;
                } else if (sortBy === 'messages') {
                    info = `**${t('LEVELS_MESSAGES')}:** ${user.stats.messagesCount} | **${t('LEVEL_LABEL')}:** ${user.level}`;
                }
                description += `${medal} **${user.username}**\n${info}\n━━━\n`;
            }
            const userRank = await LevelSystem.getUserRank(guildID, message.author.id);
            description += userRank ? `\n> **${t('LEVELS_YOUR_POSITION')}:** #${userRank}` : '';
            description += '\n\n---\n';
            description += t('LEVELS_FOOTER');
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# 🏆 ${t('LEVELS_TITLE', { server: message.guild.name })}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(description));
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('levels_refresh').setLabel(t('LEVEL_REFRESH')).setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('levels_close').setLabel(t('LEVEL_CLOSE')).setStyle(ButtonStyle.Secondary)
            );
            container.addActionRowComponents(row);
            debugHelper.log('levels', 'command replied', { guildID, requesterId, sortBy, total: leaderboard.length });
            await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });

        } catch (error) {
            debugHelper.error('levels', 'command error', { guildID: message.guildId, requesterId: message.author?.id, error: error.message });
            message.reply({
                content: moxi.translate('misc:LEVELS_ERROR_FETCH', message.guild?.settings?.Language || 'es-ES'),
                allowedMentions: { repliedUser: false }
            });
        }
    } 
};

