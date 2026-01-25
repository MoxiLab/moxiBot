const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ChannelType
} = require("discord.js");

const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const ms = require("ms");
const moxi = require("../../i18n");
const GuildSettings = require("../../Models/GuildSettings");
const { Bot } = require("../../Config");
const { EMOJIS } = require("../../Util/emojis");
const { buildDisabledMusicSessionContainer } = require("../../Components/V2/musicControlsComponent");
const { sendVoteShare } = require("../../Util/sendVoteShare");
const debugHelper = require("../../Util/debugHelper");



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

        debugHelper.log('moxi', 'slash run start', { guildId, requesterId, subcommand });

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
                debugHelper.warn('moxi', 'voice not joined', voiceContext);
                return { components: [buildV2Notice(moxi.translate('MUSIC_JOIN_VOICE', lang))], flags: v2Flags() };
            }
            if (requireSameChannel && botVoiceId && botVoiceId !== memberVoiceId) {
                debugHelper.warn('moxi', 'voice channel mismatch', voiceContext);
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
            const res = await Moxi.poru.resolve({ query: requestedTrack, source, requester: interaction.member });
            const rawLoadType = String(res?.loadType ?? '');
            const loadTypeLower = rawLoadType.toLowerCase();
            const loadTypeUpper = rawLoadType.toUpperCase(); 
            const isLoadFailed = loadTypeLower === 'error' || loadTypeUpper === 'LOAD_FAILED';
            const isNoMatches = loadTypeLower === 'empty' || loadTypeUpper === 'NO_MATCHES';
            const isPlaylistLoaded = loadTypeLower === 'playlist' || loadTypeUpper === 'PLAYLIST_LOADED';

            debugHelper.log('play', 'resolve result', {
                guildId,
                requesterId,
                loadType: rawLoadType,
                compat: { isLoadFailed, isNoMatches, isPlaylistLoaded }
            });

            if (isLoadFailed) {
                debugHelper.warn('play', 'resolve failed', { guildId, requesterId });
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_LOAD_FAILED', lang))], flags: v2Flags() });
            } else if (isNoMatches) {
                debugHelper.warn('play', 'resolve no matches', { guildId, requesterId });
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_NO_SOURCE_FOUND', lang))], flags: v2Flags() });
            }

            const player = Moxi.poru.createConnection({
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
                debugHelper.log('play', 'playlist loaded', { guildId, requesterId, playlist: playlistName, count: res.tracks.length });
                for (const track of res.tracks) {
                    track.info.requester = interaction.user;
                    player.queue.add(track);
                }

                interaction.editReply({
                    components: [buildV2Notice(moxi.translate('MUSIC_PLAYLIST_LOADED', lang, { name: playlistName, count: res.tracks.length }))],
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

            const player = Moxi.poru.players.get(interaction.guild.id);
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

            const player = Moxi.poru.players.get(interaction.guild.id);
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
            const player = Moxi.poru.players.get(interaction.guild.id);
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
            const player = Moxi.poru.players.get(interaction.guild.id);
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
            const player = Moxi.poru.players.get(interaction.guild.id)
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
                const spUri = /^(https?:\/\/)?(open\.spotify\.com)\/.+$/gi.test(currentsong.uri);

                if (!spUri) {
                    debugHelper.warn('autoplay', 'spotify only track', { guildId, requesterId });
                    return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_SPOTIFY_ONLY', lang))], flags: v2Flags() });
                }

                // Lógica para DESACTIVAR
                if (player.autoplay === true) {
                    player.autoplay = false;
                    await player.queue.clear();
                    debugHelper.log('autoplay', 'spotify disabled', { guildId, requesterId });
                    return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_SPOTIFY_AUTOPLAY_DISABLED', lang))], flags: v2Flags() });
                }

                // Lógica para ACTIVAR
                else {
                    player.autoplay = true;

                    // Buscamos por el nombre del artista para obtener canciones similares/populares
                    const search = `artist:${currentsong.author}`;

                    try {
                        const res = await Moxi.poru.resolve({
                            query: search,
                            source: "spotify",
                            requester: interaction.user
                        });

                        // Si encontramos canciones, añadimos una al azar de las primeras 10
                        if (res && res.tracks.length > 0) {
                            const trackToAdd = res.tracks[Math.floor(Math.random() * Math.min(res.tracks.length, 10))];
                            trackToAdd.info.requester = interaction.user;
                            await player.queue.add(trackToAdd);
                        }

                        debugHelper.log('autoplay', 'spotify enabled', { guildId, requesterId });

                        return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_SPOTIFY_AUTOPLAY_ENABLED', lang))], flags: v2Flags() });

                    } catch (error) {
                        console.error(error);
                        player.autoplay = false;
                        debugHelper.warn('autoplay', 'spotify error', { guildId, requesterId, message: error?.message });
                        return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_SPOTIFY_AUTOPLAY_ERROR', lang))], flags: v2Flags() });
                    }
                }
            }
        }

        if (subcommand === "stop") {
            debugHelper.log('stop', 'start', { guildId, requesterId });
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            const music = Moxi.poru.players.get(interaction.guild.id)
            if (!music) return interaction.reply({ components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() })

            if (!Moxi.previousMessage) return;

            if (Moxi.previousMessage) {
                try {
                    const player = Moxi.poru.players.get(interaction.guild.id);
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

            const player = Moxi.poru.players.get(interaction.guild.id);
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


            const player = Moxi.poru.players.get(interaction.guild.id);
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
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_TRACKS_ADDED', lang, { count: num }))], flags: v2Flags() });
            }
        }

        if (subcommand === "volume") {
            const value = interaction.options.getNumber("amount")
            debugHelper.log('volume', 'start', { guildId, requesterId, value });
            const voiceErr = ensureVoice({ requireSameChannel: true });
            if (voiceErr) return interaction.reply(voiceErr);

            const player = Moxi.poru.players.get(interaction.guild.id);
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