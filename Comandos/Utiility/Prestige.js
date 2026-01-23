const { PermissionsBitField: { Flags }, ContainerBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const LevelSystem = require('../../Global/Helpers/LevelSystem');
const BonusSystem = require('../../Global/Helpers/BonusSystem');
const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'prestige',
    alias: ['ascend', 'ascender'],
    description: 'Sube tu rango de prestige',
    usage: 'prestige',
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
        options: []
    },

    async execute(Moxi, message, args) {
        try {
            const language = message.guild?.settings?.Language || 'es-ES';
            const t = (key, vars = {}) => moxi.translate(`misc:${key}`, language, vars);
            const guildID = message.guildId;
            const requesterId = message.author?.id;
            const userID = message.author.id;
            debugHelper.log('prestige', 'command start', { guildID, requesterId });

            const config = await BonusSystem.getConfig(guildID);
            if (!config.prestigeEnabled) {
                debugHelper.warn('prestige', 'system disabled', { guildID });
                return message.reply({
                    content: t('PRESTIGE_DISABLED'),
                    allowedMentions: { repliedUser: false }
                });
            }

            const user = await LevelSystem.getUser(guildID, userID, message.author.username);
            if (!user) {
                debugHelper.warn('prestige', 'user missing', { guildID, requesterId });
                return message.reply({ content: t('PRESTIGE_NO_DATA') || '❌ No tienes datos de nivel.', allowedMentions: { repliedUser: false } });
            }

            if (user.level < config.levelRequiredForPrestige) {
                debugHelper.warn('prestige', 'level too low', { guildID, requesterId, level: user.level, required: config.levelRequiredForPrestige });
                return message.reply({ content: `❌ Necesitas estar en nivel ${config.levelRequiredForPrestige} para hacer prestige. Actualmente estás en nivel ${user.level}.`, allowedMentions: { repliedUser: false } });
            }

            const prestigedUser = await LevelSystem.prestige(guildID, userID);
            if (!prestigedUser) {
                return message.reply({
                    content: t('PRESTIGE_ERROR'),
                    allowedMentions: { repliedUser: false }
                });
            }

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# 👑 ${t('PRESTIGE_TITLE')}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    `**${t('PRESTIGE_ACHIEVED', { user: message.author.username })}**\n\n` +
                    '━━━\n' +
                    `**${t('PRESTIGE_PREVIOUS')}:** ${user.prestige}\n` +
                    `**${t('PRESTIGE_NEW')}:** ${prestigedUser.prestige}\n` +
                    `**${t('PRESTIGE_RESET_LEVEL')}:** 1\n` +
                    `**${t('PRESTIGE_TOTAL_XP')}:** ${prestigedUser.totalXp.toLocaleString()}\n` +
                    '━━━\n' +
                    t('PRESTIGE_FOOTER')
                ));
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prestige_close').setLabel(t('LEVEL_CLOSE')).setStyle(ButtonStyle.Secondary)
            );
            container.addActionRowComponents(row);
            debugHelper.log('prestige', 'command success', { guildID, requesterId, newPrestige: prestigedUser.prestige });
            await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });

            try {
                const announceChannel = message.guild.channels.cache.find(
                    ch => ch.name.includes('general') || ch.name.includes('anuncios')
                );

                if (announceChannel && announceChannel.isTextBased()) {
                    const announceContainer = new ContainerBuilder()
                        .setAccentColor(Bot.AccentColor)
                        .addTextDisplayComponents(c => c.setContent(`# 🌟 ${t('PRESTIGE_ANNOUNCE_TITLE')}`))
                        .addSeparatorComponents(s => s.setDivider(true))
                        .addTextDisplayComponents(c => c.setContent(t('PRESTIGE_ANNOUNCE_DESC', { user: message.author.username, prestige: prestigedUser.prestige })));

                    await announceChannel.send({ content: '', components: [announceContainer], flags: MessageFlags.IsComponentsV2 });
                    debugHelper.log('prestige', 'announcement sent', { guildID, requesterId, prestige: prestigedUser.prestige, channel: announceChannel.id });
                }
            } catch (error) {
                debugHelper.warn('prestige', 'announce failed', { guildID, requesterId, error: error.message });
            }

        } catch (error) {
            debugHelper.error('prestige', 'command error', { guildID: message.guildId, requesterId: message.author?.id, error: error.message });
            const t = (key) => key;
            message.reply({
                content: t('PRESTIGE_ERROR_FETCH'),
                allowedMentions: { repliedUser: false }
            });
        }
    } 
};

