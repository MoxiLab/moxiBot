const {
    SlashCommandBuilder,
    ContainerBuilder,
    MessageFlags,
    ChannelType,
    PermissionsBitField,
} = require('discord.js');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { getSettings, upsertSettings } = require('../../Util/bugStorage');
const GUIDE_THREAD_REACTION = process.env.BUG_GUIDE_REACTION || '📌';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bug')
        .setDescription('Configura el foro oficial de reportes de bugs')
        .addChannelOption(opt =>
            opt.setName('category')
                .setDescription('Categoría en la que crear el foro')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId;
        const guild = interaction.guild;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        if (!guild) return interaction.reply({ content: moxi.translate('GUILD_ONLY', lang), ephemeral: true });
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: moxi.translate('MISSING_PERMISSION', lang, { PERMISSIONS: 'Manage Channels', guild: guild.name }), ephemeral: true });
        }

        await interaction.deferReply();

        const category = interaction.options.getChannel('category');
        const existingSettings = await getSettings(guild.id);
        if (existingSettings?.forumChannelId) {
            const channelMention = `<#${existingSettings.forumChannelId}>`;
            return interaction.editReply({
                content: '',
                components: [new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('BUG_TITLE', lang)}`))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(moxi.translate('BUG_CBUG_EXISTS', lang, { channel: channelMention })))
                ],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true,
            });
        } 

        const tags = [
            { name: 'Info', moderated: false },
            { name: 'Nuevo', moderated: false },
            { name: 'Pendiente', moderated: false },
            { name: 'Complete', moderated: false },
        ];

        let forumChannel;
        try {
            forumChannel = await guild.channels.create({
                name: 'bugs',
                type: ChannelType.GuildForum,
                topic: 'Foro oficial para reportes de bugs de la comunidad',
                availableTags: tags.map(tag => {
                    const meta = STATUS_TAG_EMOJIS[tag.name];
                    return {
                        ...tag,
                        emojiId: meta?.tag?.emojiId,
                        emojiName: meta?.tag?.emojiName,
                        emojiAnimated: meta?.tag?.emojiAnimated,
                    };
                }),
                defaultAutoArchiveDuration: 1440,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        allow: [PermissionsBitField.Flags.ViewChannel],
                        deny: [PermissionsBitField.Flags.CreatePublicThreads, PermissionsBitField.Flags.SendMessages],
                    }
                ],
                parent: category?.id,
                reason: 'Foro de bugs creado con /bug',
            });
        } catch (error) {
            console.error('[bug] crear foro falló', error);
            return interaction.editReply({ content: moxi.translate('ERROR', lang) });
        }


        const infoTag = forumChannel.availableTags?.find(tag => tag.name === 'Info');
        const statusTags = {
            new: forumChannel.availableTags?.find(tag => tag.name === 'Nuevo')?.id || null,
            pending: forumChannel.availableTags?.find(tag => tag.name === 'Pendiente')?.id || null,
            complete: forumChannel.availableTags?.find(tag => tag.name === 'Complete')?.id || null,
        };

        const guidelines = moxi.translate('utility/bugGuidelines:README', lang, { guildName: guild.name });

        try {
            const infoLines = [`# ${moxi.translate('BUG_TITLE', lang)}`, guidelines];
            const guideThread = await forumChannel.threads.create({
                name: moxi.translate('BUG_GUIDE_THREAD', lang),
                autoArchiveDuration: 1440,
                appliedTags: infoTag ? [infoTag.id] : undefined,
                reason: 'Guía de reportes',
                message: infoLines.join('\n\n'),
            });
            await guideThread.setLocked(true);
            const starter = await guideThread.fetchStarterMessage().catch(() => null);
            if (starter) {
                await starter.pin().catch(() => null);
                if (GUIDE_THREAD_REACTION) {
                    await starter.react(GUIDE_THREAD_REACTION).catch(() => null);
                }
            }
        } catch (error) {
            console.error('[bug] crear hilo guía falló', error);
        }

        await upsertSettings(guild.id, {
            forumChannelId: forumChannel.id,
            tagIds: {
                info: infoTag?.id || null,
                status: statusTags,
            },
        });

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('BUG_TITLE', lang)}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(moxi.translate('BUG_CBUG_SUCCESS', lang, { channel: `<#${forumChannel.id}>` })));

        guidelines.split('\n\n').forEach(block => {
            if (block.trim()) {
                container.addTextDisplayComponents(c => c.setContent(block));
            }
        });

        await interaction.editReply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};