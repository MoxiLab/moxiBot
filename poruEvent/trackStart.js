const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    MessageFlags,
} = require('discord.js');
const formatDuration = require("../Util/formate.js");
const { musicCard } = require("musicard-quartz");
const { Bot } = require("../Config");
const { EMOJIS } = require("../Util/emojis");
const {
    buildMusicControlsRow,
    buildMusicVolumeRow,
    buildDisabledMusicSessionContainer,
} = require('../Components/V2/musicControlsComponent');

// Sin placeholder: si no hay portada real, no mostramos imagen.
const FALLBACK_IMG = String(process.env.MUSIC_FALLBACK_IMAGE_URL || '').trim();

const spotifyOEmbedCache = new Map();

function pickFirstString(...values) {
    for (const v of values) {
        if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
    return null;
}

async function getBestArtworkUrl(track, fallbackUrl) {
    const direct = pickFirstString(
        track?.info?.image,
        track?.info?.artworkUrl,
        track?.info?.thumbnail,
        track?.info?.coverUrl,
        track?.pluginInfo?.image,
        track?.pluginInfo?.artworkUrl,
        track?.pluginInfo?.thumbnail,
        track?.pluginInfo?.albumArtUrl
    );
    if (direct) return direct;

    const uri = pickFirstString(track?.info?.uri);
    const canFetch = typeof globalThis.fetch === 'function';

    let oembedUrl = uri;
    if (oembedUrl && oembedUrl.startsWith('spotify:')) {
        const parts = oembedUrl.split(':');
        const kind = parts[1];
        const id = parts[2];
        if (kind && id && ['track', 'album', 'playlist', 'episode', 'show'].includes(kind)) {
            oembedUrl = `https://open.spotify.com/${kind}/${id}`;
        }
    }

    if (oembedUrl && canFetch && oembedUrl.includes('open.spotify.com')) {
        const cached = spotifyOEmbedCache.get(oembedUrl);
        if (cached) return cached;
        try {
            const res = await globalThis.fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(oembedUrl)}`);
            if (res.ok) {
                const json = await res.json();
                const oembedThumb = pickFirstString(json?.thumbnail_url, json?.thumbnail_url_with_play_button);
                if (oembedThumb) {
                    spotifyOEmbedCache.set(oembedUrl, oembedThumb);
                    return oembedThumb;
                }
            }
        } catch {
            // ignore
        }
    }

    return pickFirstString(fallbackUrl, FALLBACK_IMG);
}

function getEnvNumber(key, fallback) {
    const raw = process.env[key];
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

// Temas conocidos en musicard-quartz: quartz+, onepiece+, vector+
// Por defecto usamos vector+ (el estilo de la card que buscabas).
const MUSIC_CARD_THEME = String(process.env.MUSIC_CARD_THEME || 'vector+');
const MUSIC_CARD_COLOR = String(process.env.MUSIC_CARD_COLOR || 'auto');
const MUSIC_CARD_BRIGHTNESS = getEnvNumber('MUSIC_CARD_BRIGHTNESS', 50);

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
        const iconURL = track?.info?.requester?.displayAvatarURL?.({ dynamic: true }) || null;
        const artworkUrl = await getBestArtworkUrl(track, null);

        // --- 2. GENERAR NUEVA TARJETA (musicard-quartz) ---
        // Nota: progress/tiempos reales se verán mejor en updates; en trackStart normalmente estamos en 0:00.
        let buffer = null;
        if (artworkUrl) {
            const quartzCard = new musicCard()
                .setName(track.info.title)
                .setAuthor(track.info.author)
                // Puede ser "auto" o un color (por ejemplo: #FFB6E6)
                .setColor(MUSIC_CARD_COLOR)
                .setTheme(MUSIC_CARD_THEME)
                .setBrightness(MUSIC_CARD_BRIGHTNESS)
                .setProgress(2)
                .setStartTime("0:00")
                .setEndTime(trackDuration)
                .setThumbnail(artworkUrl);

            try {
                buffer = await quartzCard.build();
            } catch {
                buffer = null;
            }
        }
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

        const imageUrlForGallery = hasBuffer ? `attachment://${fileName}` : (artworkUrl || null);

        const mainContainer = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(currentTitle));

        if (imageUrlForGallery) {
            mainContainer
                .addSeparatorComponents(new SeparatorBuilder())
                .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(imageUrlForGallery)
                ));
        }

        mainContainer
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

        const finalImageUrl = newMessage.attachments.first()?.url || artworkUrl || null;

        await player.set("lastSessionData", {
            title: currentTitle,
            info: currentInfo,
            imageUrl: finalImageUrl
        });

    } catch (error) {
        console.error("Error en trackStart:", error);
    }
};