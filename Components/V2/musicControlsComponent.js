const {
    ActionRowBuilder,
    SecondaryButtonBuilder,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
} = require('discord.js');

const { Bot } = require('../../Config');
const { EMOJIS, toEmojiObject } = require('../../Util/emojis');

const FALLBACK_IMG =
    'https://i.ibb.co/fdvrFrXW/Whats-App-Image-2025-12-25-at-16-02-06.jpg';

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
        new SecondaryButtonBuilder()
            .setCustomId(`repit${suffix}`)
            .setEmoji(toEmojiObject(CONTROL_EMOJIS.repit))
            .setDisabled(disabled),
        new SecondaryButtonBuilder()
            .setCustomId(`pause${suffix}`)
            .setEmoji(toEmojiObject(CONTROL_EMOJIS.pause))
            .setDisabled(disabled),
        new SecondaryButtonBuilder()
            .setCustomId(`skip${suffix}`)
            .setEmoji(toEmojiObject(CONTROL_EMOJIS.skip))
            .setDisabled(disabled),
        new SecondaryButtonBuilder()
            .setCustomId(`queue${suffix}`)
            .setEmoji(toEmojiObject(CONTROL_EMOJIS.queue))
            .setDisabled(disabled),
        new SecondaryButtonBuilder()
            .setCustomId(`autoplay${suffix}`)
            .setEmoji(toEmojiObject(CONTROL_EMOJIS.autoplay))
            .setDisabled(disabled)
    );
}

function buildMusicVolumeRow({ disabled = false } = {}) {
    const suffix = disabled ? '_d' : '';
    return new ActionRowBuilder().addComponents(
        new SecondaryButtonBuilder()
            .setCustomId(`vol_down${suffix}`)
            .setEmoji(toEmojiObject(EMOJIS.volDown))
            .setDisabled(disabled),
        new SecondaryButtonBuilder()
            .setCustomId(`vol_up${suffix}`)
            .setEmoji(toEmojiObject(EMOJIS.volUp))
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
