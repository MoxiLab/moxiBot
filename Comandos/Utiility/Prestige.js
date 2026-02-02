const { PermissionsBitField: { Flags }, ContainerBuilder, MessageFlags, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
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
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_UTILIDAD', lang);
    },
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

            const replyV2 = (title, body) => {
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(`# ${title}`))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(body))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(`${new Date().getFullYear()} • ${Moxi.user.username}`));

                return message.reply({
                    content: '',
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                });
            };

            const config = await BonusSystem.getConfig(guildID);
            const prestigeEnabled = Boolean(config && config.prestigeEnabled);
            if (!prestigeEnabled) {
                debugHelper.warn('prestige', 'system disabled', { guildID });
                const globalPrefix = (Array.isArray(Bot?.Prefix) && Bot.Prefix[0])
                    ? Bot.Prefix[0]
                    : (process.env.PREFIX || '.');
                const hint = `\n\nUn admin puede activarlo con \`${globalPrefix}levelconfig prestige si 50\` (o usando el comando slash de levelconfig).`;
                return replyV2('👑 Prestige', `❌ ${t('PRESTIGE_DISABLED')}${hint}`);
            }

            const user = await LevelSystem.getUser(guildID, userID, message.author.username);
            if (!user) {
                debugHelper.warn('prestige', 'user missing', { guildID, requesterId });
                return replyV2('👑 Prestige', `❌ ${t('PRESTIGE_NO_DATA') || 'No tienes datos de nivel.'}`);
            }

            if (user.level < config.levelRequiredForPrestige) {
                debugHelper.warn('prestige', 'level too low', { guildID, requesterId, level: user.level, required: config.levelRequiredForPrestige });
                return replyV2('👑 Prestige', `❌ Necesitas estar en nivel **${config.levelRequiredForPrestige}** para hacer prestige. Actualmente estás en nivel **${user.level}**.`);
            }

            const prestigedUser = await LevelSystem.prestige(guildID, userID);
            if (!prestigedUser) {
                return replyV2('👑 Prestige', `❌ ${t('PRESTIGE_ERROR')}`);
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
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# 👑 Prestige'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`❌ ${t('PRESTIGE_ERROR_FETCH')}`));
            message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false }
            });
        }
    }
};

