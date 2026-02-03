const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ChannelType
} = require("discord.js");

const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const ms = require("ms");
const axios = require('axios');
const moxi = require("../../i18n");
const GuildSettings = require("../../Models/GuildSettings");
const { Bot } = require("../../Config");
const { EMOJIS } = require("../../Util/emojis");
const { buildDisabledMusicSessionContainer } = require("../../Components/V2/musicControlsComponent");
const { sendVoteShare } = require("../../Util/sendVoteShare");
const debugHelper = require("../../Util/debugHelper");

let spotifyApiToken = '';
let spotifyApiTokenExpiresAt = 0;

function getSpotifyClientCreds() {
    const id = typeof process.env.SPOTIFY_CLIENT_ID === 'string' ? process.env.SPOTIFY_CLIENT_ID.trim() : '';
    const secret = typeof process.env.SPOTIFY_CLIENT_SECRET === 'string' ? process.env.SPOTIFY_CLIENT_SECRET.trim() : '';
    if (!id || !secret) return null;
    return { id, secret };
}

async function getSpotifyApiToken() {
    const now = Date.now();
    if (spotifyApiToken && now < spotifyApiTokenExpiresAt) return spotifyApiToken;

    const creds = getSpotifyClientCreds();
    if (!creds) return '';

    const res = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({ grant_type: 'client_credentials' }),
        {
            headers: {
                Authorization: 'Basic ' + Buffer.from(`${creds.id}:${creds.secret}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 12_000,
        }
    );

    const token = String(res?.data?.access_token || '').trim();
    const expiresIn = Number(res?.data?.expires_in || 0);
    if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) return '';

    spotifyApiToken = token;
    spotifyApiTokenExpiresAt = now + (expiresIn * 1000) - 60_000;
    return spotifyApiToken;
}

function extractSpotifyTrackId(normalizedSpotify) {
    const s = String(normalizedSpotify || '').trim();
    const m = s.match(/^spotify:track:([A-Za-z0-9]+)$/i);
    return m ? m[1] : '';
}

function extractSpotifyPlaylistId(normalizedSpotify) {
    const s = String(normalizedSpotify || '').trim();
    const m = s.match(/^spotify:playlist:([A-Za-z0-9]+)$/i);
    return m ? m[1] : '';
}

function extractSpotifyAlbumId(normalizedSpotify) {
    const s = String(normalizedSpotify || '').trim();
    const m = s.match(/^spotify:album:([A-Za-z0-9]+)$/i);
    return m ? m[1] : '';
}

function extractSpotifyArtistId(normalizedSpotify) {
    const s = String(normalizedSpotify || '').trim();
    const m = s.match(/^spotify:artist:([A-Za-z0-9]+)$/i);
    return m ? m[1] : '';
}

function getSpotifyMarketCandidates() {
    const raw = typeof process.env.SPOTIFY_MARKET === 'string' ? process.env.SPOTIFY_MARKET.trim().toUpperCase() : '';
    const envMarket = /^[A-Z]{2}$/.test(raw) ? raw : '';
    const candidates = [envMarket, 'US', 'ES'].filter(Boolean);
    // unique preserving order
    return Array.from(new Set(candidates));
}

async function getSpotifyTrackMeta(trackId) {
    const id = String(trackId || '').trim();
    if (!id) return null;
    const token = await getSpotifyApiToken();
    if (!token) return null;
    const res = await axios.get(`https://api.spotify.com/v1/tracks/${encodeURIComponent(id)}`,
        {
            headers: { Authorization: `Bearer ${token}` },
            params: { market: getSpotifyMarketCandidates()[0] || 'US' },
            timeout: 12_000,
        }
    );
    const name = String(res?.data?.name || '').trim();
    const artists = Array.isArray(res?.data?.artists) ? res.data.artists.map(a => String(a?.name || '').trim()).filter(Boolean) : [];
    if (!name) return null;
    return { name, artists };
}

async function getSpotifyPlaylistMetaAndTracks(playlistId, { maxTracks = 25 } = {}) {
    const id = String(playlistId || '').trim();
    if (!id) return null;

    const token = await getSpotifyApiToken();
    if (!token) return null;

    const markets = getSpotifyMarketCandidates();
    let lastErr;
    for (const market of markets) {
        try {
            // Nombre
            const playlistRes = await axios.get(
                `https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { fields: 'name', market },
                    timeout: 12_000,
                }
            );
            const name = String(playlistRes?.data?.name || '').trim() || 'Playlist';

            const tracks = [];
            let offset = 0;
            const limit = 100;
            while (tracks.length < maxTracks) {
                const res = await axios.get(
                    `https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}/tracks`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        params: {
                            limit,
                            offset,
                            market,
                            fields: 'items(track(name,artists(name),is_local)),next',
                        },
                        timeout: 12_000,
                    }
                );

                const items = Array.isArray(res?.data?.items) ? res.data.items : [];
                for (const it of items) {
                    const t = it?.track;
                    if (!t || t.is_local) continue;
                    const tName = String(t?.name || '').trim();
                    const artists = Array.isArray(t?.artists) ? t.artists.map(a => String(a?.name || '').trim()).filter(Boolean) : [];
                    const artist = artists[0] || '';
                    if (!tName) continue;
                    tracks.push({ name: tName, artist });
                    if (tracks.length >= maxTracks) break;
                }

                if (!res?.data?.next) break;
                offset += limit;
            }

            return { name, tracks, market };
        } catch (e) {
            lastErr = e;
            const status = e?.response?.status;
            // Si parece restricción por mercado, intentamos otro
            if ((status === 404 || status === 403) && markets.length > 1) continue;
            throw e;
        }
    }
    if (lastErr) throw lastErr;
    return null;
}

async function searchSpotifyPlaylistByTitle(title, { limit = 5 } = {}) {
    const q = String(title || '').trim();
    if (!q) return null;

    const token = await getSpotifyApiToken();
    if (!token) return null;

    const markets = getSpotifyMarketCandidates();
    for (const market of markets) {
        const res = await axios.get(
            'https://api.spotify.com/v1/search',
            {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    q,
                    type: 'playlist',
                    limit,
                    market,
                },
                timeout: 12_000,
            }
        );

        const items = Array.isArray(res?.data?.playlists?.items) ? res.data.playlists.items : [];
        const candidates = items.filter((p) => p && p.id && p.name);
        if (!candidates.length) continue;

        const normalizedQ = q.toLowerCase();
        const exactName = candidates.filter((p) => String(p.name).toLowerCase() === normalizedQ);
        const pool = exactName.length ? exactName : candidates;

        // Preferir playlists de Spotify si existen
        const spotifyOwned = pool.find((p) => String(p?.owner?.id || '').toLowerCase() === 'spotify')
            || pool.find((p) => String(p?.owner?.display_name || '').toLowerCase().includes('spotify'));
        const picked = spotifyOwned || pool[0];
        if (!picked) continue;
        return {
            id: String(picked.id),
            name: String(picked.name || '').trim(),
            owner: {
                id: String(picked?.owner?.id || '').trim(),
                displayName: String(picked?.owner?.display_name || '').trim(),
            },
            market,
        };
    }

    return null;
}

async function getSpotifyAlbumMetaAndTracks(albumId, { maxTracks = 25 } = {}) {
    const id = String(albumId || '').trim();
    if (!id) return null;

    const token = await getSpotifyApiToken();
    if (!token) return null;

    const markets = getSpotifyMarketCandidates();
    let lastErr;
    for (const market of markets) {
        try {
            const albumRes = await axios.get(
                `https://api.spotify.com/v1/albums/${encodeURIComponent(id)}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { market, fields: 'name' },
                    timeout: 12_000,
                }
            );
            const name = String(albumRes?.data?.name || '').trim() || 'Álbum';

            const tracks = [];
            let offset = 0;
            const limit = 50;
            while (tracks.length < maxTracks) {
                const res = await axios.get(
                    `https://api.spotify.com/v1/albums/${encodeURIComponent(id)}/tracks`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        params: {
                            market,
                            limit,
                            offset,
                            fields: 'items(name,artists(name),is_local),next',
                        },
                        timeout: 12_000,
                    }
                );
                const items = Array.isArray(res?.data?.items) ? res.data.items : [];
                for (const t of items) {
                    if (!t || t.is_local) continue;
                    const tName = String(t?.name || '').trim();
                    const artists = Array.isArray(t?.artists) ? t.artists.map(a => String(a?.name || '').trim()).filter(Boolean) : [];
                    const artist = artists[0] || '';
                    if (!tName) continue;
                    tracks.push({ name: tName, artist });
                    if (tracks.length >= maxTracks) break;
                }
                if (!res?.data?.next) break;
                offset += limit;
            }

            return { name, tracks, market };
        } catch (e) {
            lastErr = e;
            const status = e?.response?.status;
            if ((status === 404 || status === 403) && markets.length > 1) continue;
            throw e;
        }
    }
    if (lastErr) throw lastErr;
    return null;
}

async function getSpotifyArtistMetaAndTopTracks(artistId, { maxTracks = 15 } = {}) {
    const id = String(artistId || '').trim();
    if (!id) return null;

    const token = await getSpotifyApiToken();
    if (!token) return null;

    const markets = getSpotifyMarketCandidates();
    let lastErr;
    for (const market of markets) {
        try {
            const artistRes = await axios.get(
                `https://api.spotify.com/v1/artists/${encodeURIComponent(id)}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { market, fields: 'name' },
                    timeout: 12_000,
                }
            );
            const name = String(artistRes?.data?.name || '').trim() || 'Artista';

            // top-tracks requiere market
            const topRes = await axios.get(
                `https://api.spotify.com/v1/artists/${encodeURIComponent(id)}/top-tracks`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { market },
                    timeout: 12_000,
                }
            );

            const rawTracks = Array.isArray(topRes?.data?.tracks) ? topRes.data.tracks : [];
            const tracks = [];
            for (const t of rawTracks) {
                const tName = String(t?.name || '').trim();
                const artists = Array.isArray(t?.artists) ? t.artists.map(a => String(a?.name || '').trim()).filter(Boolean) : [];
                const artist = artists[0] || name;
                if (!tName) continue;
                tracks.push({ name: tName, artist });
                if (tracks.length >= maxTracks) break;
            }

            return { name, tracks, market };
        } catch (e) {
            lastErr = e;
            const status = e?.response?.status;
            if ((status === 404 || status === 403) && markets.length > 1) continue;
            throw e;
        }
    }
    if (lastErr) throw lastErr;
    return null;
}

function spotifyIdentifierToOpenUrl(spotifyId) {
    const s = String(spotifyId || '').trim();
    if (!s.startsWith('spotify:')) return null;
    const parts = s.split(':');
    const kind = parts[1];
    const id = parts[2];
    if (!kind || !id) return null;
    return `https://open.spotify.com/${kind}/${id}`;
}

async function getSpotifyOEmbedTitle(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    try {
        const oembed = await axios.get('https://open.spotify.com/oembed', {
            params: { url: u },
            timeout: 12_000,
        });
        return String(oembed?.data?.title || '').trim();
    } catch {
        return '';
    }
}

async function buildYouTubeQueryFromSpotify({ requestedTrack, normalizedSpotify }) {
    // Preferir URL real; si solo tenemos spotify:track:id, reconstruir
    let url = null;
    try {
        const u = new URL(String(requestedTrack || '').trim());
        if (/spotify\.com$/i.test(u.hostname)) url = u.toString();
    } catch {
        // ignore
    }
    if (!url && normalizedSpotify) {
        url = spotifyIdentifierToOpenUrl(normalizedSpotify);
    }
    if (!url) return '';

    const title = await getSpotifyOEmbedTitle(url);

    // Si tenemos credenciales, usar Spotify API para obtener artista y mejorar búsqueda.
    let meta = null;
    try {
        const trackId = extractSpotifyTrackId(normalizedSpotify);
        if (trackId) meta = await getSpotifyTrackMeta(trackId);
    } catch {
        // ignore
    }

    const name = (meta?.name || title || '').trim();
    const artist = (Array.isArray(meta?.artists) && meta.artists.length) ? meta.artists[0] : '';
    const q = [artist, name].filter(Boolean).join(' ');
    return q.trim();
}

function normalizeSpotifyIdentifier(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;

    // spotify:artist:<id> / spotify:album:<id> / etc
    if (raw.startsWith('spotify:')) {
        const parts = raw.split(':');
        const kind = parts[1];
        const id = parts[2];
        if (kind && id) return `spotify:${kind}:${id}`;
        return null;
    }

    // open.spotify.com URLs (including /intl-xx/ prefix)
    try {
        const url = new URL(raw);
        if (!/spotify\.com$/i.test(url.hostname)) return null;
        const path = url.pathname.replace(/^\/+/, '');
        const segments = path.split('/').filter(Boolean);
        if (!segments.length) return null;

        const known = new Set(['track', 'album', 'playlist', 'artist', 'episode', 'show']);
        let kindIndex = segments.findIndex((s) => known.has(String(s).toLowerCase()));
        if (kindIndex === -1 && segments[0].toLowerCase().startsWith('intl-')) {
            kindIndex = segments.findIndex((s) => known.has(String(s).toLowerCase()));
        }
        if (kindIndex === -1) return null;
        const kind = String(segments[kindIndex]).toLowerCase();
        const id = segments[kindIndex + 1];
        if (!id) return null;
        return `spotify:${kind}:${id}`;
    } catch {
        return null;
    }
}



module.exports = {
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_MUSICA', lang);
    },
    cooldown: 5,
    data: new SlashCommandBuilder()

        .setName("moxi")
        .setDescription(moxi.translate('commands:CMD_MOXI_DESC', 'es-ES') || 'Escucha tu música favorita')
        .addSubcommand(subcommand => subcommand
            .setName("play")
            .setDescription(moxi.translate('commands:CMD_PLAY_DESC', 'es-ES') || `${EMOJIS.musicSingle} Reproduce una canción y deja que la música fluya`)
            .addStringOption(p => p.setName('track')
                .setDescription(moxi.translate('commands:OPT_TRACK_DESC', 'es-ES') || 'Reproduce una canción').setRequired(true))
            .addStringOption(pl => pl.setName("platform")
                .setDescription(moxi.translate('commands:OPT_PLATFORM_DESC', 'es-ES') || 'Elige una plataforma para reproducir música')
                .addChoices({ name: "YouTube", value: "youtube" })
                .addChoices({ name: "Spotify", value: "spotify" }).setRequired(true)))

        .addSubcommand(subcommand => subcommand
            .setName("pause")
            .setDescription(`${EMOJIS.wind} Pausa, deja que el viento lleve tu melodía`))

        .addSubcommand(subcommand => subcommand
            .setName("resume")
            .setDescription(`${EMOJIS.star} Reanuda la música y deja que las estrellas guíen tu ritmo`))

        .addSubcommand(subcommand => subcommand
            .setName("skip")
            .setDescription(`${EMOJIS.skipNext} Salta a la siguiente canción`))

        .addSubcommand(subcommand => subcommand
            .setName("queue")
            .setDescription(`${EMOJIS.scroll} Muestra la cola de reproducción`))

        .addSubcommand(sub => sub
            .setName("autoplay")
            .setDescription(`${EMOJIS.droplet} El flujo musical sigue, como un río eterno.`)
            .addStringOption(pl => pl.setName("platform")
                .setDescription("Elige una plataforma para reproducir musica")
                .addChoices({ name: "YouTube", value: "yt" })
                .addChoices({ name: "Spotify", value: "sp" }).setRequired(true)))

        .addSubcommand(sub => sub
            .setName("add")
            .setDescription(moxi.translate('commands:OPT_ADD_AMOUNT_DESC', 'es-ES') || `${EMOJIS.leaf} Canción añadida, como una hoja en el viento.`)
            .addIntegerOption(p => p.setName('cantidad')
                .setDescription(moxi.translate('commands:OPT_ADD_AMOUNT_DESC', 'es-ES') || 'Introduce la cantidad de canciones que quieres')
                .setMinValue(1)
                .setMaxValue(30).setRequired(true)))

        .addSubcommand(o => o
            .setName("stop")
            .setDescription(`${EMOJIS.stopSign} Detén la música y permite que el silencio reine.`))

        .addSubcommand(p => p
            .setName("volume")
            .setDescription(`${EMOJIS.volUp} Ajusta el volumen y deja que la música llene el aire.`)
            .addNumberOption(v => v
                .setName("amount")
                .setDescription(moxi.translate('commands:OPT_VOLUME_AMOUNT_DESC', 'es-ES') || '¿Qué volumen quieres del 1 al 100?').setRequired(true))),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = interaction.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const requesterId = interaction.user?.id;
        const subcommand = interaction.options.getSubcommand();

        const memberVoiceId = interaction.member?.voice?.channelId;
        const botVoiceId = interaction.guild?.members?.me?.voice?.channelId;
        const voiceContext = { guildId, requesterId, subcommand };

        // Usar una sola variable para evitar redeclaraciones (SyntaxError) si el archivo se mergea mal.
        let player;

        debugHelper.log('music', 'slash run start', { guildId, requesterId, subcommand });

        function v2Flags() {
            return MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
        }

        function buildV2Notice(text) {
            return new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(String(text || ''))
                );
        }

        function buildV2Message(lines) {
            const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
            for (const line of (lines || []).filter(Boolean)) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(String(line)));
                container.addSeparatorComponents(new SeparatorBuilder());
            }
            return container;
        }

        function ensureVoice({ requireSameChannel = true } = {}) {
            if (!memberVoiceId) {
                debugHelper.warn('music', 'voice not joined', voiceContext);
                return { components: [buildV2Notice(moxi.translate('MUSIC_JOIN_VOICE', lang))], flags: v2Flags() };
            }
            if (requireSameChannel && botVoiceId && botVoiceId !== memberVoiceId) {
                debugHelper.warn('music', 'voice channel mismatch', voiceContext);
                return { components: [buildV2Notice(moxi.translate('MUSIC_SAME_VOICE_CHANNEL', lang))], flags: v2Flags() };
            }
            return null;
        }

        if (subcommand === "play") {
            // Requiere estar en un canal de voz
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            // Permisos del bot en el canal de voz (si faltan, se une pero no suena o ni conecta)
            try {
                const voiceChannel = interaction.member?.voice?.channel;
                const me = interaction.guild?.members?.me;
                const perms = voiceChannel && me ? voiceChannel.permissionsFor(me) : null;
                if (perms) {
                    const canConnect = perms.has('Connect', true);
                    const canSpeak = perms.has('Speak', true);
                    if (!canConnect || !canSpeak) {
                        debugHelper.warn('play', 'missing voice perms', { guildId, requesterId, canConnect, canSpeak });
                        await interaction.reply({
                            components: [buildV2Notice(moxi.translate('MUSIC_MISSING_PERMS', lang) || 'No tengo permisos para Conectar/Hablar en ese canal.')],
                            flags: v2Flags(),
                        });
                        return;
                    }
                }
            } catch {
                // best-effort
            }

            // Ephemeral debe establecerse en la respuesta inicial (deferReply),
            // luego editReply heredará ese estado.
            await interaction.deferReply({ ephemeral: true, flags: MessageFlags.IsComponentsV2 });
            const requestedTrack = interaction.options.getString("track");
            const lugar = interaction.options.getString("platform");
            debugHelper.log('play', 'start', { guildId, requesterId, track: requestedTrack, platform: lugar });

            // YouTube: ytsearch
            // Spotify: spsearch (lavasrc). Para URLs/URIs de Spotify, Poru enviará el identificador tal cual.
            const source = lugar === 'youtube' ? 'ytsearch' : 'spsearch';

            const normalizedSpotify = lugar === 'spotify' ? normalizeSpotifyIdentifier(requestedTrack) : null;
            // Importante: si el usuario pega un enlace open.spotify.com, preferimos pasar la URL tal cual
            // al resolver (algunos setups de Lavalink/lavasrc resuelven mejor URLs que URIs spotify:*:*).
            let query = normalizedSpotify || requestedTrack;
            if (lugar === 'spotify') {
                try {
                    const u = new URL(String(requestedTrack || '').trim());
                    if (/spotify\.com$/i.test(u.hostname)) {
                        query = u.toString();
                    }
                } catch {
                    // ignore
                }
            }
            if (normalizedSpotify) {
                debugHelper.log('play', 'normalized spotify identifier', { guildId, requesterId, from: requestedTrack, to: normalizedSpotify });
            }

            const res = await Moxi.poru.resolve({ query, source, requester: interaction.member });
            const computeFlags = (r) => {
                const raw = String(r?.loadType ?? '');
                const lower = raw.toLowerCase();
                const upper = raw.toUpperCase();
                return {
                    rawLoadType: raw,
                    isLoadFailed: lower === 'error' || upper === 'LOAD_FAILED',
                    isNoMatches: lower === 'empty' || upper === 'NO_MATCHES',
                    isPlaylistLoaded: lower === 'playlist' || upper === 'PLAYLIST_LOADED',
                };
            };

            let { rawLoadType, isLoadFailed, isNoMatches, isPlaylistLoaded } = computeFlags(res);

            debugHelper.log('play', 'resolve result', {
                guildId,
                requesterId,
                loadType: rawLoadType,
                compat: { isLoadFailed, isNoMatches, isPlaylistLoaded }
            });

            const looksLikeSpotifyPlaylist =
                lugar === 'spotify' &&
                typeof normalizedSpotify === 'string' &&
                normalizedSpotify.startsWith('spotify:playlist:');

            const looksLikeSpotifyAlbum =
                lugar === 'spotify' &&
                typeof normalizedSpotify === 'string' &&
                normalizedSpotify.startsWith('spotify:album:');

            const looksLikeSpotifyArtist =
                lugar === 'spotify' &&
                typeof normalizedSpotify === 'string' &&
                normalizedSpotify.startsWith('spotify:artist:');

            const looksLikeSpotifyTrack =
                lugar === 'spotify' &&
                typeof normalizedSpotify === 'string' &&
                normalizedSpotify.startsWith('spotify:track:');

            // Fallback: si Spotify falla por falta de lavasrc/spotify en el nodo,
            // convertir a búsqueda de YouTube usando oEmbed (no requiere credenciales).
            if ((isLoadFailed || isNoMatches) && looksLikeSpotifyTrack) {
                try {
                    const ytQuery = await buildYouTubeQueryFromSpotify({
                        requestedTrack,
                        normalizedSpotify,
                    });
                    if (ytQuery) {
                        debugHelper.warn('play', 'spotify resolve failed; fallback to ytsearch', { guildId, requesterId, ytQuery });
                        const trySources = ['ytsearch', 'ytmsearch'];
                        for (const src of trySources) {
                            const ytRes = await Moxi.poru.resolve({ query: ytQuery, source: src, requester: interaction.member });
                            const ytType = String(ytRes?.loadType ?? '');
                            const ytLower = ytType.toLowerCase();
                            const ytUpper = ytType.toUpperCase();
                            const ytFailed = ytLower === 'error' || ytUpper === 'LOAD_FAILED';
                            const ytEmpty = ytLower === 'empty' || ytUpper === 'NO_MATCHES';
                            if (!ytFailed && !ytEmpty) {
                                debugHelper.warn('play', 'spotify fallback resolved via', { guildId, requesterId, source: src });
                                // Sustituir el resultado por el de YouTube
                                // eslint-disable-next-line no-param-reassign
                                Object.assign(res, ytRes);
                                ({ rawLoadType, isLoadFailed, isNoMatches, isPlaylistLoaded } = computeFlags(res));
                                debugHelper.log('play', 'resolve result after fallback', {
                                    guildId,
                                    requesterId,
                                    loadType: rawLoadType,
                                    compat: { isLoadFailed, isNoMatches, isPlaylistLoaded }
                                });
                                break;
                            }
                        }
                    }
                } catch (e) {
                    debugHelper.warn('play', 'spotify->ytsearch fallback failed', { guildId, requesterId, message: e?.message });
                }
            }

            // Fallback Spotify (playlist/álbum/artista) -> YouTube: con client_credentials intentamos
            // leer la colección pública desde Spotify API y convertirla a búsquedas de YouTube.
            if ((isLoadFailed || isNoMatches) && (looksLikeSpotifyPlaylist || looksLikeSpotifyAlbum || looksLikeSpotifyArtist)) {
                const creds = getSpotifyClientCreds();
                if (!creds) {
                    return interaction.editReply({
                        components: [buildV2Notice('Para reproducir playlists/álbumes/artistas de Spotify necesito SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET configurados.\nAlternativa: usa YouTube o pega el nombre a buscar.')],
                        flags: v2Flags(),
                    });
                }

                const kind = looksLikeSpotifyPlaylist ? 'playlist' : (looksLikeSpotifyAlbum ? 'álbum' : 'artista');
                const id = looksLikeSpotifyPlaylist
                    ? extractSpotifyPlaylistId(normalizedSpotify)
                    : (looksLikeSpotifyAlbum ? extractSpotifyAlbumId(normalizedSpotify) : extractSpotifyArtistId(normalizedSpotify));

                if (!id) {
                    return interaction.editReply({
                        components: [buildV2Notice('No pude leer el ID de ese enlace de Spotify. Prueba a pegar el enlace completo de Spotify (open.spotify.com/...).')],
                        flags: v2Flags(),
                    });
                }

                await interaction.editReply({
                    components: [buildV2Notice(`Cargando ${kind} de Spotify (fallback a YouTube)…`)],
                    flags: MessageFlags.IsComponentsV2,
                });

                let meta;
                let usedAlternative = null;
                try {
                    if (looksLikeSpotifyPlaylist) meta = await getSpotifyPlaylistMetaAndTracks(id, { maxTracks: 25 });
                    else if (looksLikeSpotifyAlbum) meta = await getSpotifyAlbumMetaAndTracks(id, { maxTracks: 25 });
                    else meta = await getSpotifyArtistMetaAndTopTracks(id, { maxTracks: 15 });
                } catch (e) {
                    const status = e?.response?.status;
                    const oembedTitle = await getSpotifyOEmbedTitle(requestedTrack);
                    const oembedOk = Boolean(oembedTitle);
                    const markets = getSpotifyMarketCandidates();
                    const marketsHint = markets.length ? `\nMercados probados: ${markets.join(', ')}. Puedes fijarlo con SPOTIFY_MARKET=US (o ES).` : '';

                    // Caso especial: algunas playlists editoriales públicas dan 404/403 con client_credentials.
                    // Intentamos encontrar una alternativa accesible por título y reproducirla.
                    if ((status === 404 || status === 403) && oembedOk && looksLikeSpotifyPlaylist) {
                        try {
                            const alt = await searchSpotifyPlaylistByTitle(oembedTitle, { limit: 5 });
                            if (alt?.id && alt.id !== id) {
                                debugHelper.warn('play', 'spotify playlist not accessible; trying title-search alternative', {
                                    guildId,
                                    requesterId,
                                    title: oembedTitle,
                                    altId: alt.id,
                                    altOwner: alt.owner?.id || alt.owner?.displayName,
                                    market: alt.market,
                                });
                                meta = await getSpotifyPlaylistMetaAndTracks(alt.id, { maxTracks: 25 });
                                usedAlternative = { title: oembedTitle, alt };
                            }
                        } catch (e2) {
                            debugHelper.warn('play', 'spotify title-search alternative failed', { guildId, requesterId, message: e2?.message || String(e2) });
                        }
                    }

                    // Si la alternativa funcionó, continuamos.
                    if (meta && Array.isArray(meta.tracks) && meta.tracks.length) {
                        // continue
                    } else if (status === 404 || status === 403) {
                        if (!oembedOk) {
                            return interaction.editReply({
                                components: [buildV2Notice(`No puedo reproducir ese ${kind} de Spotify.\nSi es privado o no es accesible públicamente, no tengo acceso. Hazlo público o usa YouTube.`)],
                                flags: v2Flags(),
                            });
                        }

                        return interaction.editReply({
                            components: [buildV2Notice(`Parece público (${oembedTitle}), pero Spotify API devolvió ${status}.${marketsHint}\nEsto puede ser una restricción de Spotify. Prueba con SPOTIFY_MARKET=US o usa YouTube.`)],
                            flags: v2Flags(),
                        });
                    } else if (status === 401) {
                        return interaction.editReply({
                            components: [buildV2Notice('No pude autenticar con Spotify (401).\nRevisa SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET y vuelve a intentar.')],
                            flags: v2Flags(),
                        });
                    } else {
                        debugHelper.warn('play', 'spotify collection fallback failed', { guildId, requesterId, status, message: e?.message || String(e) });
                        return interaction.editReply({
                            components: [buildV2Notice(`No pude cargar ese ${kind} de Spotify ahora mismo. Intenta más tarde o usa YouTube.`)],
                            flags: v2Flags(),
                        });
                    }
                }

                if (!meta || !Array.isArray(meta.tracks) || meta.tracks.length === 0) {
                    return interaction.editReply({
                        components: [buildV2Notice(`No pude leer canciones de ese ${kind} de Spotify. Si es privado o está restringido por región, no tendré acceso.`)],
                        flags: v2Flags(),
                    });
                }

                debugHelper.log('play', 'spotify collection fallback meta', { guildId, requesterId, kind, name: meta.name, count: meta.tracks.length, market: meta.market, usedAlternative: Boolean(usedAlternative) });

                player = Moxi.poru.createConnection({
                    guildId: interaction.guildId,
                    voiceChannel: interaction.member.voice.channelId,
                    textChannel: interaction.channel.id,
                    deaf: true,
                });

                let added = 0;
                for (const t of meta.tracks) {
                    const ytQuery = [t.artist, t.name].filter(Boolean).join(' ').trim();
                    if (!ytQuery) continue;
                    try {
                        const ytRes = await Moxi.poru.resolve({ query: ytQuery, source: 'ytsearch', requester: interaction.member });
                        const first = Array.isArray(ytRes?.tracks) ? ytRes.tracks[0] : null;
                        if (!first) continue;
                        first.info.requester = interaction.user;
                        player.queue.add(first);
                        added += 1;
                    } catch (e) {
                        debugHelper.warn('play', 'spotify collection track resolve failed', { guildId, requesterId, message: e?.message || String(e) });
                    }
                }

                if (added === 0) {
                    return interaction.editReply({
                        components: [buildV2Notice(`No pude convertir ese ${kind} a resultados de YouTube. Prueba con otro o usa YouTube directo.`)],
                        flags: v2Flags(),
                    });
                }

                const altNote = usedAlternative
                    ? `\nNota: no pude leer la playlist original por API y usé una alternativa por título (${usedAlternative.title}).`
                    : '';
                await interaction.editReply({
                    components: [buildV2Notice(`Cargado desde Spotify (${kind}): ${meta.name} • ${added} canciones.${altNote}`)],
                    flags: MessageFlags.IsComponentsV2,
                });

                if (!player.isPlaying) {
                    try {
                        await player.play();
                    } catch (e) {
                        debugHelper.error('play', 'player.play failed (spotify collection fallback)', { guildId, requesterId, message: e?.message || String(e) });
                    }
                }

                return;
            }

            if (isLoadFailed) {
                debugHelper.warn('play', 'resolve failed', { guildId, requesterId });
                if (looksLikeSpotifyPlaylist || looksLikeSpotifyAlbum || looksLikeSpotifyArtist) {
                    return interaction.editReply({ components: [buildV2Notice('No pude cargar ese enlace de Spotify. Si es privado/restringido, no puedo acceder; si es público, revisa SPOTIFY_CLIENT_ID/SECRET y prueba con SPOTIFY_MARKET=US (o ES) o usa YouTube.')], flags: v2Flags() });
                }
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_LOAD_FAILED', lang))], flags: v2Flags() });
            } else if (isNoMatches) {
                debugHelper.warn('play', 'resolve no matches', { guildId, requesterId });
                if (looksLikeSpotifyPlaylist || looksLikeSpotifyAlbum || looksLikeSpotifyArtist) {
                    return interaction.editReply({ components: [buildV2Notice('No pude encontrar resultados para ese enlace de Spotify. Si es privado/restringido, no puedo acceder; si es público, revisa SPOTIFY_CLIENT_ID/SECRET y prueba con SPOTIFY_MARKET=US (o ES) o usa YouTube.')], flags: v2Flags() });
                }
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_NO_SOURCE_FOUND', lang))], flags: v2Flags() });
            }

            player = Moxi.poru.createConnection({
                guildId: interaction.guildId,
                voiceChannel: interaction.member.voice.channelId,
                textChannel: interaction.channel.id,
                deaf: true,
            });

            // Si es un Stage channel, el bot puede quedar "suppressed" y no sonar.
            // Best-effort: intentar quitar suppress o pedir speak.
            try {
                const voiceChannel = interaction.member?.voice?.channel;
                const me = interaction.guild?.members?.me;
                if (voiceChannel?.type === ChannelType.GuildStageVoice && me?.voice) {
                    // En stage, el bot puede entrar como "audience".
                    if (typeof me.voice.setSuppressed === 'function') {
                        await me.voice.setSuppressed(false).catch(() => null);
                        debugHelper.log('play', 'stage unsuppress attempted', { guildId, requesterId });
                    }
                    if (typeof me.voice.setRequestToSpeak === 'function') {
                        await me.voice.setRequestToSpeak(true).catch(() => null);
                        debugHelper.log('play', 'stage requestToSpeak attempted', { guildId, requesterId });
                    }
                }
            } catch {
                // best-effort
            }

            if (isPlaylistLoaded) {
                const playlistName = res?.playlistInfo?.name || res?.playlistInfo?.title || 'Playlist';
                const playlistTracks = res.tracks;
                debugHelper.log('play', 'playlist loaded', { guildId, requesterId, playlist: playlistName, count: playlistTracks.length });
                for (const track of playlistTracks) {
                    track.info.requester = interaction.user;
                    player.queue.add(track);
                }

                interaction.editReply({
                    components: [buildV2Notice(moxi.translate('MUSIC_PLAYLIST_LOADED', lang, { name: playlistName, count: playlistTracks.length }))],
                    flags: MessageFlags.IsComponentsV2
                });

            } else {
                // Lógica de canción única
                if (res.tracks && res.tracks.length > 0) {
                    const track = res.tracks[0];
                    track.info.requester = interaction.user;
                    player.queue.add(track);
                    debugHelper.log('play', 'track queued', { guildId, requesterId, title: track.info.title });
                    interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_TRACK_ADDED', lang, { title: track.info.title }))], flags: MessageFlags.IsComponentsV2 });
                } else {
                    debugHelper.warn('play', 'track invalid', { guildId, requesterId });
                    interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_TRACK_INVALID', lang))], flags: MessageFlags.IsComponentsV2 })
                }
            }
            if (!player.isPlaying) {
                try {
                    await player.play();
                } catch (e) {
                    debugHelper.error('play', 'player.play failed', { guildId, requesterId, message: e?.message || String(e) });
                }
            }
            if (player.isPlaying) {
                debugHelper.log('play', 'player playing', { guildId, requesterId });
            }
        }

        // Continue with other subcommands here
        if (subcommand === "pause") {
            debugHelper.log('pause', 'start', { guildId, requesterId });
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            player = Moxi.poru.players.get(interaction.guild.id);
            if (!player) return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() });
            if (player.isPaused) {
                debugHelper.warn('pause', 'already paused', { guildId, requesterId });
                return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_MUSIC_PAUSED', lang))], flags: v2Flags() });
            }

            player.pause(true);
            debugHelper.log('pause', 'paused', { guildId, requesterId });
            return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_MUSIC_PAUSED', lang))], flags: v2Flags() });
        }

        if (subcommand === "resume") {
            debugHelper.log('resume', 'start', { guildId, requesterId });
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            player = Moxi.poru.players.get(interaction.guild.id);
            if (!player) return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() });

            if (!player.isPaused) {
                debugHelper.warn('resume', 'not paused', { guildId, requesterId });
                return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_NOT_PAUSED', lang) || 'The player is not paused')], flags: v2Flags() });
            }

            player.pause(false);
            debugHelper.log('resume', 'resumed', { guildId, requesterId });
            return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_MUSIC_RESUMED', lang))], flags: v2Flags() });
        }

        if (subcommand === "skip") {
            debugHelper.log('skip', 'start', { guildId, requesterId });
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            const music = Moxi.poru.players.get(interaction.guild.id)
            if (!music) return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() });
            player = Moxi.poru.players.get(interaction.guild.id);
            player.skip();
            debugHelper.log('skip', 'skipped', { guildId, requesterId });
            return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_TRACK_SKIPPED', lang))], flags: v2Flags() });
        }


        if (subcommand === "queue") {
            debugHelper.log('queue', 'start', { guildId, requesterId });
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            const music = Moxi.poru.players.get(interaction.guild.id)
            if (!music) return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() });
            player = Moxi.poru.players.get(interaction.guild.id);
            const queue =
                player.queue.length > 5 ? player.queue.slice(0, 5) : player.queue;
            const nowPlaying = `${moxi.translate('MUSIC_NOW_PLAYING', lang)}: [${player.currentTrack.info.title}](${player.currentTrack.info.uri}) • \`${ms(player.currentTrack.info.length)}\``;
            const nextUpBlock = queue.length
                ? `${moxi.translate('MUSIC_NEXT_UP', lang)}\n${queue
                    .map((track, index) => moxi.translate('MUSIC_QUEUE_ENTRY', lang, { num: index + 1, title: track.info.title, url: track.info.uri }))
                    .join('\n')}`
                : '';
            const footer = `${moxi.translate('MUSIC_QUEUE_TRACKS', lang, { count: player.queue.length })}`;
            const container = buildV2Message([nowPlaying, nextUpBlock, footer]);
            debugHelper.log('queue', 'info', { guildId, requesterId, queueLength: player.queue.length });
            return interaction.reply({ components: [container], flags: v2Flags() });
        }

        if (subcommand === "autoplay") {
            debugHelper.log('autoplay', 'start', { guildId, requesterId });
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            const plat = interaction.options.getString("platform")
            player = Moxi.poru.players.get(interaction.guild.id)
            if (!player) return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() })

            debugHelper.log('autoplay', 'branch selected', { guildId, requesterId, platform: plat });
            if (plat === "yt") {
                debugHelper.log('autoplay', 'yt path', { guildId, requesterId });
                await interaction.deferReply({ flags: v2Flags() });

                const currentsong = player.currentTrack.info;

                const ytUri = /^(https?:\/\/)?(www\.)?(m\.)?(music\.)?(youtube\.com|youtu\.?be)\/.+$/gi.test(currentsong.uri);

                if (!ytUri) {
                    debugHelper.warn('autoplay', 'yt only track', { guildId, requesterId });
                    return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_AUTOPLAY_YT_ONLY', lang))], flags: v2Flags() });
                }

                if (player.autoplay === true) {
                    player.autoplay = false;

                    await player.queue.clear();
                    debugHelper.log('autoplay', 'yt disabled', { guildId, requesterId });
                    return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_AUTOPLAY_DISABLED', lang))], flags: v2Flags() });
                } else {
                    player.autoplay = true;

                    if (ytUri) {
                        const identifier = currentsong.identifier;
                        const search = `https://music.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
                        const res = await Moxi.poru.resolve({ query: search, source: "ytmsearch", requester: interaction.user });

                        await player.queue.add(res.tracks[Math.floor(Math.random() * res.tracks.length) ?? 5]);

                        debugHelper.log('autoplay', 'yt enabled', { guildId, requesterId, playlist: res.playlistInfo?.name });
                        return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_AUTOPLAY_ENABLED', lang))], flags: v2Flags() });
                    }
                }

            }

            if (plat === "sp") {
                debugHelper.log('autoplay', 'sp path', { guildId, requesterId });
                await interaction.deferReply({ flags: v2Flags() });

                const currentsong = player.currentTrack.info;

                // Validamos que la canción actual sea realmente de Spotify
                const spUri = /^(https?:\/\/)?(open\.spotify\.com)\/.+$/gi.test(currentsong.uri) || /^spotify:/i.test(currentsong.uri);

                if (!spUri) {
                    debugHelper.warn('autoplay', 'spotify only track', { guildId, requesterId });
                    return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_AUTOPLAY_SPOTIFY_ONLY', lang))], flags: v2Flags() });
                }

                // Lógica para DESACTIVAR
                if (player.autoplay === true) {
                    player.autoplay = false;
                    await player.queue.clear();
                    debugHelper.log('autoplay', 'spotify disabled', { guildId, requesterId });
                    return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_AUTOPLAY_SPOTIFY_DISABLED', lang))], flags: v2Flags() });
                }

                // Lógica para ACTIVAR
                else {
                    player.autoplay = true;

                    // Buscamos por el nombre del artista para obtener canciones similares/populares
                    const search = `artist:${currentsong.author}`;

                    try {
                        const res = await Moxi.poru.resolve({
                            query: search,
                            source: "spsearch",
                            requester: interaction.user
                        });

                        // Si encontramos canciones, añadimos una al azar de las primeras 10
                        if (res && res.tracks.length > 0) {
                            const trackToAdd = res.tracks[Math.floor(Math.random() * Math.min(res.tracks.length, 10))];
                            trackToAdd.info.requester = interaction.user;
                            await player.queue.add(trackToAdd);
                        }

                        debugHelper.log('autoplay', 'spotify enabled', { guildId, requesterId });

                        return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_AUTOPLAY_SPOTIFY_ENABLED', lang))], flags: v2Flags() });

                    } catch (error) {
                        console.error(error);
                        player.autoplay = false;
                        debugHelper.warn('autoplay', 'spotify error', { guildId, requesterId, message: error?.message });
                        return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_AUTOPLAY_SPOTIFY_ERROR', lang))], flags: v2Flags() });
                    }
                }
            }
        }

        if (subcommand === "stop") {
            debugHelper.log('stop', 'start', { guildId, requesterId });
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            player = Moxi.poru.players.get(interaction.guild.id);
            if (!player) return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() })

            if (!Moxi.previousMessage) return;

            if (Moxi.previousMessage) {
                try {
                    const lastSession = player ? await player.get("lastSessionData") : null;
                    if (lastSession) {
                        const disabledContainer = buildDisabledMusicSessionContainer({
                            title: lastSession.title,
                            info: lastSession.info,
                            imageUrl: lastSession.imageUrl,
                            footerText: "_**Moxi Studios**_ - Sesión Finalizada",
                        });
                        await Moxi.previousMessage.edit({
                            components: [disabledContainer],
                            flags: MessageFlags.IsComponentsV2,
                        });
                    }
                } catch (e) {
                    // si no se puede editar (mensaje viejo/no-v2), ignoramos
                }
            }
            if (player) {
                await sendVoteShare(Moxi, player).catch(() => { });
                await player.destroy();
            }

            debugHelper.log('stop', 'destroyed', { guildId, requesterId });

            return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_PLAYER_DISCONNECTED', lang))], flags: v2Flags() });

        }

        if (subcommand === "add") {
            debugHelper.log('add', 'start', { guildId, requesterId });
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            const num = interaction.options.getInteger("cantidad")
            const music = Moxi.poru.players.get(interaction.guild.id)
            if (!music) return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() })

            debugHelper.log('add', 'adding tracks', { guildId, requesterId, amount: num });
            await interaction.deferReply({ flags: v2Flags() });


            player = Moxi.poru.players.get(interaction.guild.id);
            const currentsong = player.currentTrack.info;
            const ytUri = /^(https?:\/\/)?(www\.)?(m\.)?(music\.)?(youtube\.com|youtu\.?be)\/.+$/gi.test(currentsong.uri);

            if (!ytUri) {
                debugHelper.warn('add', 'not youtube track', { guildId, requesterId });
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_ADD_YT_ONLY', lang))], flags: v2Flags() });
            }

            if (ytUri) {
                const identifier = currentsong.identifier;
                const search = `https://music.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
                const res = await Moxi.poru.resolve({ query: search, source: "ytmsearch", requester: interaction.user });

                const numAdd = num;
                for (let i = 0; i < numAdd; i++) {
                    const randomIndex = Math.floor(Math.random() * res.tracks.length);
                    await player.queue.add(res.tracks[randomIndex]);
                }
                debugHelper.log('add', 'tracks added', { guildId, requesterId, amount: num });
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_ADDED_TRACKS', lang, { count: num }))], flags: v2Flags() });
            }
        }

        if (subcommand === "volume") {
            const value = interaction.options.getNumber("amount")
            debugHelper.log('volume', 'start', { guildId, requesterId, value });
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            player = Moxi.poru.players.get(interaction.guild.id);
            if (!value) {
                debugHelper.warn('volume', 'no value provided', { guildId, requesterId, currentVolume: player?.volume });
                return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_CURRENT_VOLUME', lang, { volume: player.volume }))], flags: v2Flags() });
            } else {
                await player.setVolume(value);
                debugHelper.log('volume', 'set', { guildId, requesterId, value });
                return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_VOLUME_SET', lang, { volume: value }))], flags: v2Flags() });
            }
        }
    }
}