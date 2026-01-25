const {
    ActionRowBuilder,
    AttachmentBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    MessageFlags,
    ButtonStyle
} = require('discord.js');
const { ButtonBuilder } = require('../Util/compatButtonBuilder');
const formatDuration = require("../Util/formate.js");
const { muzicard } = require("muzicard");
const { Bot } = require("../Config");
const { EMOJIS } = require("../Util/emojis");
const {
    buildMusicControlsRow,
    buildMusicVolumeRow,
    buildDisabledMusicSessionContainer,
} = require('../Components/V2/musicControlsComponent');

const FALLBACK_IMG = "https://i.ibb.co/fdvrFrXW/Whats-App-Image-2025-12-25-at-16-02-06.jpg";

function toHexColor(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '#FFB6E6';
    return `#${(n & 0xffffff).toString(16).padStart(6, '0')}`.toUpperCase();
}

module.exports = async (Moxi, player, track) => {
    try {
        const channel = Moxi.channels.cache.get(player.textChannel);
        if (!channel) return;

        // --- 1. DESACTIVAR BOTONES ANTERIORES ---
        const lastSession = await player.get("lastSessionData");

        if (Moxi.previousMessage && lastSession) {
            try {
                const disabledContainer = buildDisabledMusicSessionContainer({
                    title: lastSession.title,
                    info: lastSession.info,
                    imageUrl: lastSession.imageUrl,
                    footerText: "_**Moxi Studios**_ - Sesión Finalizada",
                });

                await Moxi.previousMessage.edit({
                    components: [disabledContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (e) {
                console.log("Error al desactivar botones anteriores:", e.message);
            }
        }

        // --- 2. GENERAR NUEVA TARJETA ---
        const trackDuration = track.info.isStream ? "LIVE" : formatDuration(track.info.length);
        const solicitud = track?.info?.requester?.tag || "Moxi Autoplay";
        const iconURL = track?.info?.requester?.displayAvatarURL?.({ dynamic: true }) || FALLBACK_IMG;

        const card = new muzicard()
            .setName(track.info.title)
            .setAuthor(track.info.author)
            .setColor(toHexColor(Bot.AccentColor))
            .setTheme("blueskyx")
            .setProgress(35)
            .setStartTime("0:00")
            .setEndTime(trackDuration)
            .setThumbnail(track.info.image || iconURL);

        const buffer = await card.build();
        const fileName = `moxi_${Date.now()}.png`;
        const hasBuffer = Buffer.isBuffer(buffer) && buffer.length > 0;
        const attachmentPayload = hasBuffer ? { attachment: buffer, name: fileName } : null;


        // Traducción internacionalizada con idioma de la base de datos
        const moxi = require("../i18n");
        let guildId = player.guild?.id || player.guildId || player.options?.guildId;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const currentTitle = `${EMOJIS.nowPlayingAnim} ${moxi.translate('MUSIC_NOW_PLAYING', lang)} [${track.info.title}](${track.info.uri})`;
        const currentInfo = `**${moxi.translate('MUSIC_QUEUE_COUNT', lang)}** \`${player.queue.length}\`\n**${moxi.translate('MUSIC_REQUESTED_BY', lang)}** \`${solicitud}\``;

        // --- 3. CONSTRUIR CONTAINER NUEVO ---

        // Fila 1: Controles
        const buttonsRow = buildMusicControlsRow();

        // Fila 2: Volumen
        const volumeRow = buildMusicVolumeRow();

        const imageUrlForGallery = hasBuffer ? `attachment://${fileName}` : (track.info.image || iconURL || FALLBACK_IMG);

        const mainContainer = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(currentTitle))
            .addSeparatorComponents(new SeparatorBuilder())
            .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(imageUrlForGallery)
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(currentInfo))
            .addActionRowComponents(buttonsRow)
            .addSeparatorComponents(new SeparatorBuilder()) // Separador solicitado
            .addActionRowComponents(volumeRow)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${EMOJIS.studioAnim} _**Moxi Studios**_ `));

        // --- 4. ENVIAR Y GUARDAR ---
        const sendPayload = {
            components: [mainContainer],
            flags: MessageFlags.IsComponentsV2,
        };

        if (attachmentPayload) sendPayload.files = [attachmentPayload];

        const newMessage = await channel.send(sendPayload);

        Moxi.previousMessage = newMessage;

        const finalImageUrl = newMessage.attachments.first()?.url || track.info.image || iconURL;

        await player.set("lastSessionData", {
            title: currentTitle,
            info: currentInfo,
            imageUrl: finalImageUrl
        });

    } catch (error) {
        console.error("Error en trackStart:", error);
    }
};