const { PermissionsBitField: { Flags }, ApplicationCommandOptionType, ActionRowBuilder, PrimaryButtonBuilder, DangerButtonBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } = require('discord.js');
const LevelSystem = require('../../Global/Helpers/LevelSystem');
const { generateRankImage } = require('../../Global/Helpers/WelcomeImage');
const RankConfig = require('../../Models/RankSchema');
const GuildData = require('../../Models/GuildSchema');
const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');

const translate = (key, language, vars = {}) => moxi.translate(`misc:${key}`, language, vars);

module.exports = {
    name: 'rank',
    alias: ['rango', 'level-card'],
    description: 'Muestra tu tarjeta de rango actual',
    usage: 'rank [usuario]',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
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
        options: [
            {
                name: 'usuario',
                description: 'Usuario para ver el rango (opcional)',
                type: ApplicationCommandOptionType.User,
                required: false
            }
        ]
    },

    async execute(Moxi, message, args) {
        try {
            const language = message.guild?.settings?.Language || 'es-ES';
            const t = (key, vars = {}) => translate(key, language, vars);
            const guildID = message.guildId;
            const requesterId = message.author?.id;
            const target = message.mentions.users.first() || await Moxi.users.fetch(args[0]).catch(() => null) || message.author;
            const userID = target.id;
            debugHelper.log('rank', 'command start', { guildID, requesterId, targetId: userID });

            // Fuente de verdad: RankSchema (colección separada). Fallback legacy: guilds embebido.
            const rankDoc = await RankConfig.findOne({ guildID }).lean().catch(() => null);
            const legacyGuildDoc = !rankDoc ? await GuildData.findOne({ guildID }).lean().catch(() => null) : null;
            const style = (rankDoc?.style && typeof rankDoc.style === 'string')
                ? rankDoc.style
                : ((legacyGuildDoc?.Rank?.style && typeof legacyGuildDoc.Rank.style === 'string')
                    ? legacyGuildDoc.Rank.style
                    : ((legacyGuildDoc?.Welcome?.style && typeof legacyGuildDoc.Welcome.style === 'string') ? legacyGuildDoc.Welcome.style : 'sylphacard'));

            const fetchedUser = await Moxi.users.fetch(target.id, { force: true }).catch(() => null);
            const userForCard = fetchedUser || target;
            const userBanner = fetchedUser?.bannerURL?.({ size: 2048, extension: 'png' });
            const guildBg = message.guild?.bannerURL?.({ size: 2048, extension: 'png' })
                || message.guild?.iconURL?.({ size: 2048, extension: 'png' });
            const backgroundUrl = userBanner || guildBg || undefined;

            const levelInfo = await LevelSystem.getUserLevelInfo(guildID, userID);
            if (!levelInfo) {
                debugHelper.warn('rank', 'missing level data', { guildID, requesterId, targetId: userID });
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(`# ❌ ${t('LEVEL_NO_DATA', { user: target.username })}`));
                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
            }

            const rankPos = await LevelSystem.getUserRank(guildID, userID, 'level').catch(() => null);
            if (rankPos) levelInfo.rank = rankPos;

            const rankImage = await generateRankImage(userForCard, levelInfo, { style, backgroundUrl });
            if (!rankImage) {
                debugHelper.warn('rank', 'missing rank image', { guildID, requesterId, targetId: userID });
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(`# ❌ ${t('LEVEL_ERROR_IMAGE')}`));
                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
            }

            const year = new Date().getFullYear();
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`#  ${t('LEVEL_CARD_TITLE', { user: target.username })}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    `**${t('LEVEL_LABEL')}:** ${levelInfo.level} | **${t('LEVEL_XP')}:** ${levelInfo.currentXp}\n` +
                    `**${t('LEVEL_PRESTIGE')}:** ${levelInfo.prestige}\n` +
                    `**Estilo:** ${style}\n` +
                    `━━━\n${t('LEVEL_CARD_FOOTER')}`
                ))
                .addSeparatorComponents(s => s.setDivider(true))
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL('attachment://rank.png')
                    )
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`© ${Moxi.user.username} • ${year}`));

            const row = new ActionRowBuilder().addComponents(
                new PrimaryButtonBuilder().setCustomId('rank_refresh').setLabel(t('LEVEL_REFRESH')),
                new DangerButtonBuilder().setCustomId('rank_close').setLabel(t('LEVEL_CLOSE'))
            );
            container.addActionRowComponents(row);

            debugHelper.log('rank', 'command replied', { guildID, requesterId, targetId: userID, rank: levelInfo.rank });
            await message.reply({ content: '', components: [container], files: [{ attachment: rankImage, name: 'rank.png' }], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        } catch (error) {
            debugHelper.error('rank', 'command error', { guildID: message.guildId, requesterId: message.author?.id, error: error.message });
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# ❌ ${moxi.translate('misc:LEVEL_ERROR_FETCH', message.guild?.settings?.Language || 'es-ES')}`));
            message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }
    },

    interactionRun: async (client, interaction) => {
        try {
            await interaction.deferReply();
            const language = interaction.guild?.settings?.Language || 'es-ES';
            const t = (key, vars = {}) => translate(key, language, vars);
            const guildID = interaction.guildId;
            const requesterId = interaction.user?.id;
            const target = interaction.options.getUser('usuario') || interaction.user;
            const userID = target.id;
            debugHelper.log('rank', 'interaction start', { guildID, requesterId, targetId: userID });

            // Fuente de verdad: RankSchema (colección separada). Fallback legacy: guilds embebido.
            const rankDoc = await RankConfig.findOne({ guildID }).lean().catch(() => null);
            const legacyGuildDoc = !rankDoc ? await GuildData.findOne({ guildID }).lean().catch(() => null) : null;
            const style = (rankDoc?.style && typeof rankDoc.style === 'string')
                ? rankDoc.style
                : ((legacyGuildDoc?.Rank?.style && typeof legacyGuildDoc.Rank.style === 'string')
                    ? legacyGuildDoc.Rank.style
                    : ((legacyGuildDoc?.Welcome?.style && typeof legacyGuildDoc.Welcome.style === 'string') ? legacyGuildDoc.Welcome.style : 'sylphacard'));

            const fetchedUser = await client.users.fetch(target.id, { force: true }).catch(() => null);
            const userForCard = fetchedUser || target;
            const userBanner = fetchedUser?.bannerURL?.({ size: 2048, extension: 'png' });
            const guildBg = interaction.guild?.bannerURL?.({ size: 2048, extension: 'png' })
                || interaction.guild?.iconURL?.({ size: 2048, extension: 'png' });
            const backgroundUrl = userBanner || guildBg || undefined;

            const levelInfo = await LevelSystem.getUserLevelInfo(guildID, userID);
            if (!levelInfo) {
                debugHelper.warn('rank', 'interaction missing level data', { guildID, requesterId, targetId: userID });
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(`# ❌ ${t('LEVEL_NO_DATA', { user: target.username })}`));
                return interaction.editReply({ content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            }

            const rankPos = await LevelSystem.getUserRank(guildID, userID, 'level').catch(() => null);
            if (rankPos) levelInfo.rank = rankPos;

            const rankImage = await generateRankImage(userForCard, levelInfo, { style, backgroundUrl });
            if (!rankImage) {
                debugHelper.warn('rank', 'interaction missing rank image', { guildID, requesterId, targetId: userID });
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(`# ❌ ${t('LEVEL_ERROR_IMAGE')}`));
                return interaction.editReply({ content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            }

            const year = new Date().getFullYear();
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# ${t('LEVEL_CARD_TITLE', { user: target.username })}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    `**${t('LEVEL_LABEL')}:** ${levelInfo.level} | **${t('LEVEL_XP')}:** ${levelInfo.currentXp}\n` +
                    `**${t('LEVEL_PRESTIGE')}:** ${levelInfo.prestige}\n` +
                    `**Estilo:** ${style}\n` +
                    `━━━\n${t('LEVEL_CARD_FOOTER')}`
                ))
                .addSeparatorComponents(s => s.setDivider(true))
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL('attachment://rank.png')
                    )
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`© ${client.user.username} • ${year}`));

            const row = new ActionRowBuilder().addComponents(
                new PrimaryButtonBuilder().setCustomId('rank_refresh').setLabel(t('LEVEL_REFRESH')),
                new DangerButtonBuilder().setCustomId('rank_close').setLabel(t('LEVEL_CLOSE'))
            );
            container.addActionRowComponents(row);

            debugHelper.log('rank', 'interaction replied', { guildID, requesterId, targetId: userID, rank: levelInfo.rank });
            await interaction.editReply({ components: [container], files: [{ attachment: rankImage, name: 'rank.png' }], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            debugHelper.error('rank', 'interaction error', { guildID: interaction.guildId, requesterId: interaction.user?.id, error: error.message });
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# ❌ ${moxi.translate('misc:LEVEL_ERROR_FETCH', interaction.guild?.settings?.Language || 'es-ES')}`));
            interaction.editReply({ content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }
    }
};

