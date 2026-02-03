const {
    PermissionsBitField: { Flags },
    ApplicationCommandOptionType,
    ContainerBuilder,
    MessageFlags,
    ButtonStyle,
    AttachmentBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
} = require('discord.js');

const { ButtonBuilder } = require('../../Util/compatButtonBuilder');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const RankConfig = require('../../Models/RankSchema');
const GuildData = require('../../Models/GuildSchema');
const LevelSystem = require('../../Global/Helpers/LevelSystem');
const debugHelper = require('../../Util/debugHelper');
const { generateRankImage } = require('../../Global/Helpers/WelcomeImage');
const { setSectionButtonAccessory } = require('../../Util/v2SectionAccessory');

function normalizeStyle(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (!v) return '';
    if (v === 'discord-arts' || v === 'discordarts' || v === 'discord') return 'discord-arts';
    if (v === 'canvacard' || v === 'canva') return 'canvacard';
    if (v === 'sylphacard' || v === 'sylpha') return 'sylphacard';
    return '';
}

const SYLPHA_FILE = 'rank-style-sylphacard.png';
const ARTS_FILE = 'rank-style-discord-arts.png';
const CANVA_FILE = 'rank-style-canvacard.png';

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

    // Opción 1 (Sylphacard)
    container.addSectionComponents(section =>
        setSectionButtonAccessory(
            section.addTextDisplayComponents(t => t.setContent(
                `**Sylphacard**${selectedStyle === 'sylphacard' ? ' ✅' : ''}` +
                `${hasSylpha ? '' : '\n_❌ Preview no disponible_'}`
            )),
            new ButtonBuilder()
                .setCustomId('rank_style_sylphacard')
                .setLabel('Usar Sylphacard')
                .setStyle(selectedStyle === 'sylphacard' ? ButtonStyle.Success : ButtonStyle.Primary)
                .setDisabled(!!disabled)
        )
    );

    if (hasSylpha) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(`attachment://${SYLPHA_FILE}`)
            )
        );
    }

    container.addSeparatorComponents(s => s.setDivider(true));

    // Opción 2 (Discord-Arts)
    container.addSectionComponents(section =>
        setSectionButtonAccessory(
            section.addTextDisplayComponents(t => t.setContent(
                `**Discord-Arts**${selectedStyle === 'discord-arts' ? ' ✅' : ''}` +
                `${hasArts ? '' : '\n_❌ Preview no disponible_'}`
            )),
            new ButtonBuilder()
                .setCustomId('rank_style_discord-arts')
                .setLabel('Usar Discord-Arts')
                .setStyle(selectedStyle === 'discord-arts' ? ButtonStyle.Success : ButtonStyle.Primary)
                .setDisabled(!!disabled)
        )
    );

    if (hasArts) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(`attachment://${ARTS_FILE}`)
            )
        );
    }

    container.addSeparatorComponents(s => s.setDivider(true));

    // Opción 3 (Canvacard)
    container.addSectionComponents(section =>
        setSectionButtonAccessory(
            section.addTextDisplayComponents(t => t.setContent(
                `**Canvacard**${selectedStyle === 'canvacard' ? ' ✅' : ''}` +
                `${hasCanva ? '' : '\n_❌ Preview no disponible_'}`
            )),
            new ButtonBuilder()
                .setCustomId('rank_style_canvacard')
                .setLabel('Usar Canvacard')
                .setStyle(selectedStyle === 'canvacard' ? ButtonStyle.Success : ButtonStyle.Primary)
                .setDisabled(!!disabled)
        )
    );

    if (hasCanva) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(`attachment://${CANVA_FILE}`)
            )
        );
    }

    container.addSeparatorComponents(s => s.setDivider(true));

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
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
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

        const rankDoc = await RankConfig.findOne({ guildID }).lean().catch(() => null);
        const legacyGuildDoc = !rankDoc ? await GuildData.findOne({ guildID }).lean().catch(() => null) : null;
        const currentStyle = (rankDoc?.style && typeof rankDoc.style === 'string')
            ? rankDoc.style
            : ((legacyGuildDoc?.Rank?.style && typeof legacyGuildDoc.Rank.style === 'string')
                ? legacyGuildDoc.Rank.style
                : ((legacyGuildDoc?.Welcome?.style && typeof legacyGuildDoc.Welcome.style === 'string') ? legacyGuildDoc.Welcome.style : 'sylphacard'));

        if (normalized) {
            await RankConfig.findOneAndUpdate(
                { guildID },
                { $set: { style: normalized, updatedAt: new Date() } },
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

        if (previews.sylphacard) {
            files.push(new AttachmentBuilder(previews.sylphacard, { name: SYLPHA_FILE }));
        }
        if (previews['discord-arts']) {
            files.push(new AttachmentBuilder(previews['discord-arts'], { name: ARTS_FILE }));
        }
        if (previews.canvacard) {
            files.push(new AttachmentBuilder(previews.canvacard, { name: CANVA_FILE }));
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

            await RankConfig.findOneAndUpdate(
                { guildID },
                { $set: { style: selected, updatedAt: new Date() } },
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

        const rankDoc = await RankConfig.findOne({ guildID }).lean().catch(() => null);
        const legacyGuildDoc = !rankDoc ? await GuildData.findOne({ guildID }).lean().catch(() => null) : null;
        const currentStyle = (rankDoc?.style && typeof rankDoc.style === 'string')
            ? rankDoc.style
            : ((legacyGuildDoc?.Rank?.style && typeof legacyGuildDoc.Rank.style === 'string')
                ? legacyGuildDoc.Rank.style
                : ((legacyGuildDoc?.Welcome?.style && typeof legacyGuildDoc.Welcome.style === 'string') ? legacyGuildDoc.Welcome.style : 'sylphacard'));

        if (normalized) {
            await RankConfig.findOneAndUpdate(
                { guildID },
                { $set: { style: normalized, updatedAt: new Date() } },
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

        if (previews.sylphacard) {
            files.push(new AttachmentBuilder(previews.sylphacard, { name: SYLPHA_FILE }));
        }
        if (previews['discord-arts']) {
            files.push(new AttachmentBuilder(previews['discord-arts'], { name: ARTS_FILE }));
        }
        if (previews.canvacard) {
            files.push(new AttachmentBuilder(previews.canvacard, { name: CANVA_FILE }));
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

            await RankConfig.findOneAndUpdate(
                { guildID },
                { $set: { style: selected, updatedAt: new Date() } },
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

                await replyMsg.edit({ components: [disabled] });
            } catch (_) { }
            debugHelper.log('ranksetup', 'interaction collector ended', { guildId: guildID });
        });
    }
};
