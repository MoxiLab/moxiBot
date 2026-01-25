const {
    ActionRowBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
} = require('discord.js');

const { ButtonBuilder } = require('../../Util/compatButtonBuilder');

const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');

const FALLBACK_IMG = String(process.env.MUSIC_FALLBACK_IMAGE_URL || 'https://cdn.discordapp.com/embed/avatars/0.png').trim();

const CONTROL_EMOJIS = {
    repit: EMOJIS.Icon,
    pause: EMOJIS.pause1,
    skip: EMOJIS.icon,
    queue: EMOJIS.queue,
    autoplay: EMOJIS.infinito,
};

function buildMusicControlsRow({ disabled = false } = {}) {
    const suffix = disabled ? '_d' : '';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`repit${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONTROL_EMOJIS.repit)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`pause${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONTROL_EMOJIS.pause)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`skip${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONTROL_EMOJIS.skip)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`queue${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONTROL_EMOJIS.queue)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`autoplay${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CONTROL_EMOJIS.autoplay)
            .setDisabled(disabled)
    );
}

function buildMusicVolumeRow({ disabled = false } = {}) {
    const suffix = disabled ? '_d' : '';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`vol_down${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(EMOJIS.volDown)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`vol_up${suffix}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(EMOJIS.volUp)
            .setDisabled(disabled)
    );
}

function buildDisabledMusicSessionContainer({ title, info, imageUrl, footerText } = {}) {
    let safeImageUrl = imageUrl;
    if (!safeImageUrl || typeof safeImageUrl !== 'string' || safeImageUrl.startsWith('attachment://')) {
        safeImageUrl = FALLBACK_IMG;
    }

    const resolvedTitle = title || '';
    const resolvedInfo = info || '';
    const resolvedFooterText = footerText || '_**Moxi Studios**_ - Sesión Finalizada';

    return new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedTitle))
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(safeImageUrl))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedInfo))
        .addActionRowComponents(buildMusicControlsRow({ disabled: true }))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(buildMusicVolumeRow({ disabled: true }))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedFooterText));
}

function buildActiveMusicSessionContainer({ title, info, imageUrl, footerText } = {}) {
    let safeImageUrl = imageUrl;
    if (!safeImageUrl || typeof safeImageUrl !== 'string' || safeImageUrl.startsWith('attachment://')) {
        safeImageUrl = FALLBACK_IMG;
    }

    const resolvedTitle = title || '';
    const resolvedInfo = info || '';
    const resolvedFooterText = footerText || `> ${EMOJIS.studioAnim} _**Moxi Studios**_ `;

    return new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedTitle))
        .addSeparatorComponents(new SeparatorBuilder())
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(safeImageUrl))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedInfo))
        .addActionRowComponents(buildMusicControlsRow({ disabled: false }))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(buildMusicVolumeRow({ disabled: false }))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedFooterText));
}

module.exports = {
    buildMusicControlsRow,
    buildMusicVolumeRow,
    buildDisabledMusicSessionContainer,
    buildActiveMusicSessionContainer,
};
