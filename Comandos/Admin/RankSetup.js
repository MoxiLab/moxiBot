const {
    PermissionsBitField: { Flags },
    ApplicationCommandOptionType,
    ContainerBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
} = require('discord.js');

const { Bot } = require('../../Config');
const GuildData = require('../../Models/GuildSchema');
const LevelSystem = require('../../Global/Helpers/LevelSystem');
const debugHelper = require('../../Util/debugHelper');
const { generateRankImage } = require('../../Global/Helpers/WelcomeImage');

function normalizeStyle(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (!v) return '';
    if (v === 'discord-arts' || v === 'discordarts' || v === 'discord') return 'discord-arts';
    if (v === 'canvacard' || v === 'canva') return 'canvacard';
    if (v === 'sylphacard' || v === 'sylpha') return 'sylphacard';
    return '';
}

function buildPanel({ selectedStyle, availability }) {
    const { hasSylpha, hasArts, hasCanva, disabled } = availability;

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(t => t.setContent(
            `#  Setup de Rank\n\n` +
            `Elige el estilo de la tarjeta de rank.\n` +
            `Estilo actual: **${selectedStyle}**`
        ))
        .addSeparatorComponents(s => s.setDivider(true));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('rank_style_sylphacard')
            .setLabel('Sylphacard')
            .setStyle(selectedStyle === 'sylphacard' ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(!!disabled),
        new ButtonBuilder()
            .setCustomId('rank_style_discord-arts')
            .setLabel('Discord-Arts')
            .setStyle(selectedStyle === 'discord-arts' ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(!!disabled),
        new ButtonBuilder()
            .setCustomId('rank_style_canvacard')
            .setLabel('Canvacard')
            .setStyle(selectedStyle === 'canvacard' ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(!!disabled),
    );

    const notes = [
        `**Sylphacard**${selectedStyle === 'sylphacard' ? ' ✅' : ''}${hasSylpha ? '' : ' (preview no disponible)'}`,
        `**Discord-Arts**${selectedStyle === 'discord-arts' ? ' ✅' : ''}${hasArts ? '' : ' (preview no disponible)'}`,
        `**Canvacard**${selectedStyle === 'canvacard' ? ' ✅' : ''}${hasCanva ? '' : ' (preview no disponible)'}`,
    ].join('\n');

    container.addTextDisplayComponents(t => t.setContent(notes));
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addActionRowComponents(row);

    return container;
}

async function getBackgroundUrl(client, guild, user) {
    const fetchedUser = await client.users.fetch(user.id, { force: true }).catch(() => null);
    const userBanner = fetchedUser?.bannerURL?.({ size: 2048, extension: 'png' }) || undefined;
    const guildBg = guild?.bannerURL?.({ size: 2048, extension: 'png' })
        || guild?.iconURL?.({ size: 2048, extension: 'png' })
        || undefined;
    return userBanner || guildBg;
}

async function renderPreviews({ client, guild, user, levelInfo, backgroundUrl }) {
    const styles = ['sylphacard', 'discord-arts', 'canvacard'];

    const out = {
        sylphacard: null,
        'discord-arts': null,
        canvacard: null,
    };

    for (const style of styles) {
        try {
            const buf = await generateRankImage(user, levelInfo, { style, backgroundUrl });
            if (buf) out[style] = buf;
        } catch (_) {
            out[style] = null;
        }
    }

    return out;
}

module.exports = {
    name: 'ranksetup',
    alias: ['rank-config', 'rankstyle', 'rank-setup'],
    description: 'Configura el estilo de la tarjeta de rank',
    usage: 'ranksetup [style] | ranksetup style <sylphacard|discord-arts|canvacard>',
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
                name: 'style',
                description: 'Elige el estilo de rank',
                type: ApplicationCommandOptionType.String,
                required: false,
                choices: [
                    { name: 'Sylphacard', value: 'sylphacard' },
                    { name: 'Discord-Arts', value: 'discord-arts' },
                    { name: 'Canvacard', value: 'canvacard' },
                ]
            }
        ]
    },

    execute: async (Moxi, message, args) => {
        debugHelper.log('ranksetup', 'execute start', {
            guildId: message.guild?.id || 'dm',
            userId: message.author?.id,
            args: args?.slice(0, 2)
        });
        const guild = message.guild;
        if (!guild) return;

        const guildID = message.guildId;
        const raw = args[0];
        const normalized = normalizeStyle(raw);

        const serverDoc = await GuildData.findOne({ guildID }).lean().catch(() => null);
        const currentStyle = (serverDoc?.Rank?.style && typeof serverDoc.Rank.style === 'string')
            ? serverDoc.Rank.style
            : ((serverDoc?.Welcome?.style && typeof serverDoc.Welcome.style === 'string') ? serverDoc.Welcome.style : 'sylphacard');

        if (normalized) {
            await GuildData.findOneAndUpdate(
                { guildID },
                { $set: { 'Rank.style': normalized, 'Rank.updatedAt': new Date() }, $setOnInsert: { guildName: guild.name } },
                { upsert: true, new: true }
            ).catch(() => null);

            debugHelper.log('ranksetup', 'style overridden via args', { guildId: guildID, normalized });

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(t => t.setContent(`# ✅ Rank style actualizado\nAhora: **${normalized}**`));
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }

        const user = message.author;
        let levelInfo = await LevelSystem.getUserLevelInfo(guildID, user.id).catch(() => null);
        if (!levelInfo) {
            levelInfo = { level: 10, currentXp: 50, totalXp: 1000, prestige: 0 };
        }
        const rankPos = await LevelSystem.getUserRank(guildID, user.id, 'level').catch(() => null);
        if (rankPos) levelInfo.rank = rankPos;

        const backgroundUrl = await getBackgroundUrl(Moxi, guild, user);
        const previews = await renderPreviews({ client: Moxi, guild, user, levelInfo, backgroundUrl });

        const files = [];
        const items = [];

        if (previews.sylphacard) {
            files.push(new AttachmentBuilder(previews.sylphacard, { name: 'rank-style-sylphacard.png' }));
            items.push(new MediaGalleryItemBuilder().setURL('attachment://rank-style-sylphacard.png'));
        }
        if (previews['discord-arts']) {
            files.push(new AttachmentBuilder(previews['discord-arts'], { name: 'rank-style-discord-arts.png' }));
            items.push(new MediaGalleryItemBuilder().setURL('attachment://rank-style-discord-arts.png'));
        }
        if (previews.canvacard) {
            files.push(new AttachmentBuilder(previews.canvacard, { name: 'rank-style-canvacard.png' }));
            items.push(new MediaGalleryItemBuilder().setURL('attachment://rank-style-canvacard.png'));
        }

        const container = buildPanel({
            selectedStyle: currentStyle,
            availability: {
                hasSylpha: !!previews.sylphacard,
                hasArts: !!previews['discord-arts'],
                hasCanva: !!previews.canvacard,
                disabled: false,
            }
        });

        if (items.length) {
            container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...items));
            container.addSeparatorComponents(s => s.setDivider(true));
        }

        const sent = await message.reply({
            content: '',
            components: [container],
            files,
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false }
        });

        debugHelper.log('ranksetup', 'panel sent', { guildId: guildID, hasMedia: files.length > 0 });

        const collector = sent.createMessageComponentCollector({
            time: 2 * 60 * 1000,
            filter: (i) => i.user.id === message.author.id &&
                (i.customId === 'rank_style_sylphacard' || i.customId === 'rank_style_discord-arts' || i.customId === 'rank_style_canvacard')
        });

        collector.on('collect', async (i) => {
            debugHelper.log('ranksetup', 'collector select', { guildId: guildID, componentId: i.customId, userId: i.user.id });
            const selected = i.customId === 'rank_style_discord-arts'
                ? 'discord-arts'
                : (i.customId === 'rank_style_canvacard' ? 'canvacard' : 'sylphacard');

            await GuildData.findOneAndUpdate(
                { guildID },
                { $set: { 'Rank.style': selected, 'Rank.updatedAt': new Date() }, $setOnInsert: { guildName: guild.name } },
                { upsert: true, new: true }
            ).catch(() => null);

            debugHelper.log('ranksetup', 'style selected via collector', { guildId: guildID, selected });

            const updated = buildPanel({
                selectedStyle: selected,
                availability: {
                    hasSylpha: !!previews.sylphacard,
                    hasArts: !!previews['discord-arts'],
                    hasCanva: !!previews.canvacard,
                    disabled: false,
                }
            });

            if (items.length) {
                updated.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...items));
                updated.addSeparatorComponents(s => s.setDivider(true));
            }

            await i.update({ components: [updated], files });
        });

        collector.on('end', async () => {
            try {
                const disabled = buildPanel({
                    selectedStyle: currentStyle,
                    availability: {
                        hasSylpha: !!previews.sylphacard,
                        hasArts: !!previews['discord-arts'],
                        hasCanva: !!previews.canvacard,
                        disabled: true,
                    }
                });

                if (items.length) {
                    disabled.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...items));
                    disabled.addSeparatorComponents(s => s.setDivider(true));
                }

                await sent.edit({ components: [disabled] });
                debugHelper.log('ranksetup', 'collector ended', { guildId: guildID });
            } catch (_) { }
        });
    },

    interactionRun: async (client, interaction) => {
        debugHelper.log('ranksetup', 'interaction start', {
            guildId: interaction.guildId || 'dm',
            userId: interaction.user?.id,
            options: interaction.options?.data?.map(opt => ({ name: opt?.name, value: opt?.value })) || []
        });
        await interaction.deferReply();

        const guild = interaction.guild;
        const guildID = interaction.guildId;
        const user = interaction.user;

        const raw = interaction.options.getString('style');
        const normalized = normalizeStyle(raw);

        const serverDoc = await GuildData.findOne({ guildID }).lean().catch(() => null);
        const currentStyle = (serverDoc?.Rank?.style && typeof serverDoc.Rank.style === 'string')
            ? serverDoc.Rank.style
            : ((serverDoc?.Welcome?.style && typeof serverDoc.Welcome.style === 'string') ? serverDoc.Welcome.style : 'sylphacard');

        if (normalized) {
            await GuildData.findOneAndUpdate(
                { guildID },
                { $set: { 'Rank.style': normalized, 'Rank.updatedAt': new Date() }, $setOnInsert: { guildName: guild?.name } },
                { upsert: true, new: true }
            ).catch(() => null);

            debugHelper.log('ranksetup', 'style overridden via slash', { guildId: guildID, normalized });

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(t => t.setContent(`# ✅ Rank style actualizado\nAhora: **${normalized}**`));

            return interaction.editReply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        let levelInfo = await LevelSystem.getUserLevelInfo(guildID, user.id).catch(() => null);
        if (!levelInfo) {
            levelInfo = { level: 10, currentXp: 50, totalXp: 1000, prestige: 0 };
        }
        const rankPos = await LevelSystem.getUserRank(guildID, user.id, 'level').catch(() => null);
        if (rankPos) levelInfo.rank = rankPos;

        const backgroundUrl = await getBackgroundUrl(client, guild, user);
        const previews = await renderPreviews({ client: client, guild, user, levelInfo, backgroundUrl });

        const files = [];
        const items = [];

        if (previews.sylphacard) {
            files.push(new AttachmentBuilder(previews.sylphacard, { name: 'rank-style-sylphacard.png' }));
            items.push(new MediaGalleryItemBuilder().setURL('attachment://rank-style-sylphacard.png'));
        }
        if (previews['discord-arts']) {
            files.push(new AttachmentBuilder(previews['discord-arts'], { name: 'rank-style-discord-arts.png' }));
            items.push(new MediaGalleryItemBuilder().setURL('attachment://rank-style-discord-arts.png'));
        }
        if (previews.canvacard) {
            files.push(new AttachmentBuilder(previews.canvacard, { name: 'rank-style-canvacard.png' }));
            items.push(new MediaGalleryItemBuilder().setURL('attachment://rank-style-canvacard.png'));
        }

        const container = buildPanel({
            selectedStyle: currentStyle,
            availability: {
                hasSylpha: !!previews.sylphacard,
                hasArts: !!previews['discord-arts'],
                hasCanva: !!previews.canvacard,
                disabled: false,
            }
        });

        if (items.length) {
            container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...items));
            container.addSeparatorComponents(s => s.setDivider(true));
        }

        await interaction.editReply({
            content: '',
            components: [container],
            files,
            flags: MessageFlags.IsComponentsV2
        });

        debugHelper.log('ranksetup', 'interaction panel sent', { guildId: guildID, hasMedia: files.length > 0 });

        const replyMsg = await interaction.fetchReply().catch(() => null);
        if (!replyMsg) return;

        const collector = replyMsg.createMessageComponentCollector({
            time: 2 * 60 * 1000,
            filter: (i) => i.user.id === interaction.user.id &&
                (i.customId === 'rank_style_sylphacard' || i.customId === 'rank_style_discord-arts' || i.customId === 'rank_style_canvacard')
        });

        collector.on('collect', async (i) => {
            debugHelper.log('ranksetup', 'interaction collector select', { guildId: guildID, componentId: i.customId, userId: i.user.id });
            const selected = i.customId === 'rank_style_discord-arts'
                ? 'discord-arts'
                : (i.customId === 'rank_style_canvacard' ? 'canvacard' : 'sylphacard');

            await GuildData.findOneAndUpdate(
                { guildID },
                { $set: { 'Rank.style': selected, 'Rank.updatedAt': new Date() }, $setOnInsert: { guildName: guild?.name } },
                { upsert: true, new: true }
            ).catch(() => null);

            debugHelper.log('ranksetup', 'interaction collector style selected', { guildId: guildID, selected });

            const updated = buildPanel({
                selectedStyle: selected,
                availability: {
                    hasSylpha: !!previews.sylphacard,
                    hasArts: !!previews['discord-arts'],
                    hasCanva: !!previews.canvacard,
                    disabled: false,
                }
            });

            if (items.length) {
                updated.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...items));
                updated.addSeparatorComponents(s => s.setDivider(true));
            }

            await i.update({ components: [updated], files });
        });

        collector.on('end', async () => {
            try {
                const disabled = buildPanel({
                    selectedStyle: currentStyle,
                    availability: {
                        hasSylpha: !!previews.sylphacard,
                        hasArts: !!previews['discord-arts'],
                        hasCanva: !!previews.canvacard,
                        disabled: true,
                    }
                });

                if (items.length) {
                    disabled.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...items));
                    disabled.addSeparatorComponents(s => s.setDivider(true));
                }

                await replyMsg.edit({ components: [disabled] });
            } catch (_) { }
            debugHelper.log('ranksetup', 'interaction collector ended', { guildId: guildID });
        });
    }
};
