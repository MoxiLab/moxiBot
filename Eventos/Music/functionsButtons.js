const Moxi = require("../../index");
const {
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    TextDisplayBuilder,
    ActionRowBuilder,
    ButtonStyle,
} = require("discord.js");
const moxi = require("../../i18n");
const { Bot } = require("../../Config");
const { EMOJIS } = require("../../Util/emojis");
const ms = require("ms");
const { buildActiveMusicSessionContainer } = require("../../Components/V2/musicControlsComponent");
const { ButtonBuilder } = require("../../Util/compatButtonBuilder");
const { resolveBlacklistBlock, logBlacklistHit } = require("../../Util/blacklistStorage");

function v2Flags() {
    return MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
}

async function safeReply(interaction, payload) {
    if (interaction.deferred || interaction.replied) {
        try {
            return await interaction.followUp(payload);
        } catch {
            return null;
        }
    }
    return interaction.reply(payload);
}

async function safeDeferReply(interaction, payload) {
    if (interaction.deferred || interaction.replied) return null;
    try {
        return await interaction.deferReply(payload);
    } catch {
        return null;
    }
}

function buildV2Message(lines) {
    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
    for (const line of lines.filter(Boolean)) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(String(line)));
        container.addSeparatorComponents(new SeparatorBuilder());
    }
    return container;
}

function buildV2Notice(text) {
    return new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(String(text || '')));
}

function ensureSameVoiceChannel(interaction, lang) {
    const memberChannel = interaction.member?.voice?.channelId;
    const botChannel = interaction.guild?.members?.me?.voice?.channelId;
    if (!memberChannel) {
        return { components: [buildV2Notice(moxi.translate('MUSIC_JOIN_VOICE', lang))], flags: v2Flags() };
    }
    if (botChannel && memberChannel !== botChannel) {
        return { components: [buildV2Notice(moxi.translate('MUSIC_SAME_VOICE_CHANNEL', lang))], flags: v2Flags() };
    }
    return null;
}

async function tryUpdateMainPanel(interaction, player, lang, extraLine) {
    try {
        if (!interaction.message) return;
        if (!player || !player.currentTrack || !player.currentTrack.info) return;

        const track = player.currentTrack;
        const solicitud = track?.info?.requester?.tag || track?.info?.requester?.username || "Moxi Autoplay";

        const title = `${EMOJIS.nowPlayingAnim} ${moxi.translate('MUSIC_NOW_PLAYING', lang)} [${track.info.title}](${track.info.uri})`;
        const infoBase = `**${moxi.translate('MUSIC_QUEUE_COUNT', lang)}** \`${player.queue.length}\`\n**${moxi.translate('MUSIC_REQUESTED_BY', lang)}** \`${solicitud}\``;
        const info = extraLine ? `${infoBase}\n${extraLine}` : infoBase;

        const imageUrl =
            interaction.message.attachments?.first()?.url ||
            track.info.image ||
            undefined;

        const container = buildActiveMusicSessionContainer({
            title,
            info,
            imageUrl,
        });

        await interaction.message.edit({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    } catch (_) {
        // Si no se puede editar el panel (permisos, mensaje antiguo, etc.), ignoramos.
    }
}


Moxi.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
        // Si este listener está registrado 2+ veces (hot reload), evitamos doble acknowledge.
        if (interaction.deferred || interaction.replied) return;

        try {
            const guildId = interaction.guild?.id || null;
            const userId = interaction.user?.id || null;
            if (guildId && userId) {
                const roleIds = Array.from(interaction?.member?.roles?.cache?.keys?.() || []);
                const block = await resolveBlacklistBlock({
                    guildId,
                    userId,
                    action: 'music',
                    commandName: interaction.customId || null,
                    roleIds,
                });
                if (block?.blocked && block.entry) {
                    await logBlacklistHit({
                        client: Moxi,
                        userId,
                        guildId,
                        action: 'music-button',
                        source: 'interaction',
                        commandName: interaction.customId || null,
                        entry: block.entry,
                    });

                    const lang = await moxi.guildLang(interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
                    const t = (key, fallback) => {
                        const out = moxi.translate(key, lang);
                        return (out && out !== key) ? out : fallback;
                    };

                    let msg = '';
                    if (block.targetType === 'guild') {
                        msg = t('misc:BLACKLIST_GUILD_BLOCKED', 'Este servidor está en blacklist global y no puedes usar el bot aquí.');
                    } else if (block.scope === 'global') {
                        msg = t('misc:BLACKLIST_GLOBAL_BLOCKED', 'Estás en blacklist global y no puedes usar el bot.');
                    } else {
                        msg = t('misc:BLACKLIST_LOCAL_BLOCKED', 'Estás en blacklist de este servidor y no puedes usar el bot.');
                    }

                    const details = [];
                    if (block.entry.reason) {
                        details.push(`${t('misc:BLACKLIST_REASON', 'Motivo')}: ${block.entry.reason}`);
                    }
                    if (typeof block.entry.level === 'number') {
                        details.push(`${t('misc:BLACKLIST_LEVEL', 'Nivel')}: ${block.entry.level}`);
                    }
                    if (block.entry.expiresAt) {
                        const ts = Math.floor(new Date(block.entry.expiresAt).getTime() / 1000);
                        if (ts) details.push(`${t('misc:BLACKLIST_EXPIRES', 'Expira')}: <t:${ts}:R>`);
                    }
                    if (details.length) msg += `\n${details.join('\n')}`;

                    return safeReply(interaction, { components: [buildV2Notice(msg)], flags: v2Flags() });
                }
            }
        } catch {
            // best-effort
        }

        // Botones deshabilitados del panel V2 anterior (por seguridad)
        if (typeof interaction.customId === 'string' && interaction.customId.endsWith('_d')) {
            const lang = await moxi.guildLang(interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const msg = moxi.translate('MUSIC_PLAYER_DISCONNECTED', lang) || moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang);
            return safeReply(interaction, { components: [buildV2Notice(msg)], flags: v2Flags() });
        }

        if (interaction.customId === "repit") {
            const lang = await moxi.guildLang(interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            {
                const guard = ensureSameVoiceChannel(interaction, lang);
                if (guard) return safeReply(interaction, guard);
            }
            if (!interaction.member.voice.channel)
                return safeReply(interaction, {
                    components: [buildV2Notice(moxi.translate('MUSIC_JOIN_VOICE', lang))],
                    flags: v2Flags(),
                });
            const player = Moxi.poru.players.get(interaction.guild.id);
            if (!player) return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() })
            await safeDeferReply(interaction, { flags: v2Flags() });
            if (!player.currentTrack.info.isSeekable) {
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_NOT_SEEKABLE', lang))], flags: v2Flags() });
            } else {
                await player.seekTo(0);
                await tryUpdateMainPanel(interaction, player, lang, moxi.translate('MUSIC_TRACK_REPEATED', lang));
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_TRACK_REPEATED', lang))], flags: v2Flags() });
            }
        }

        if (interaction.customId === "pause") {
            const lang = await moxi.guildLang(interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            {
                const guard = ensureSameVoiceChannel(interaction, lang);
                if (guard) return safeReply(interaction, guard);
            }
            const player = Moxi.poru.players.get(interaction.guild.id);
            const music = Moxi.poru.players.get(interaction.guild.id)
            if (!music) return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() })
            if (!interaction.member.voice.channel)
                return safeReply(interaction, {
                    components: [buildV2Notice(moxi.translate('MUSIC_JOIN_VOICE', lang))],
                    flags: v2Flags(),
                });
            if (player.isPaused) {
                player.pause(false)
                await tryUpdateMainPanel(interaction, player, lang, moxi.translate('MUSIC_MUSIC_RESUMED', lang));
                return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_MUSIC_RESUMED', lang))], flags: v2Flags() });
            } else {
                player.pause(true);
                await tryUpdateMainPanel(interaction, player, lang, moxi.translate('MUSIC_MUSIC_PAUSED', lang));
                return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_MUSIC_PAUSED', lang))], flags: v2Flags() });
            }
        }


        if (interaction.customId === "skip") {
            const lang = await moxi.guildLang(interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            {
                const guard = ensureSameVoiceChannel(interaction, lang);
                if (guard) return safeReply(interaction, guard);
            }
            if (!interaction.member.voice.channel)
                return safeReply(interaction, {
                    components: [buildV2Notice(moxi.translate('MUSIC_JOIN_VOICE', lang))],
                    flags: v2Flags(),
                });
            const player = Moxi.poru.players.get(interaction.guild.id);
            if (!player)
                return safeReply(interaction, {
                    components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))],
                    flags: v2Flags(),
                });
            player.skip();
            await tryUpdateMainPanel(interaction, player, lang, moxi.translate('MUSIC_TRACK_SKIPPED', lang));
            return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_TRACK_SKIPPED', lang))], flags: v2Flags() });
        }


        if (interaction.customId === "queue") {
            const lang = await moxi.guildLang(interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            {
                const guard = ensureSameVoiceChannel(interaction, lang);
                if (guard) return safeReply(interaction, guard);
            }
            if (!interaction.member.voice.channel)
                return safeReply(interaction, {
                    components: [buildV2Notice(moxi.translate('MUSIC_JOIN_VOICE', lang))],
                    flags: v2Flags(),
                });
            const player = Moxi.poru.players.get(interaction.guild.id);
            const music = Moxi.poru.players.get(interaction.guild.id)
            if (!music) return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() })
            const queue = player.queue.length > 5 ? player.queue.slice(0, 5) : player.queue;
            const nowPlaying = `${moxi.translate('MUSIC_NOW_PLAYING', lang)}: [${player.currentTrack.info.title}](${player.currentTrack.info.uri}) • \`${ms(player.currentTrack.info.length)}\``;
            const nextUpBlock = queue.length
                ? `${moxi.translate('MUSIC_NEXT_UP', lang)}\n${queue
                    .map((track, index) => `**${index + 1}.** [${track.info.title}](${track.info.uri})`)
                    .join('\n')}`
                : '';
            const footer = moxi.translate('MUSIC_FOOTER', lang, { user: interaction.user.username });

            const container = buildV2Message([nowPlaying, nextUpBlock, footer]);
            return safeReply(interaction, { components: [container], flags: v2Flags() });
        }

        if (interaction.customId === "autoplay") {
            const lang = await moxi.guildLang(interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            {
                const guard = ensureSameVoiceChannel(interaction, lang);
                if (guard) return safeReply(interaction, guard);
            }
            const player = Moxi.poru.players.get(interaction.guild.id);
            if (!player) return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() });

            await safeDeferReply(interaction, { flags: v2Flags() });
            const currentsong = player.currentTrack.info;
            const ytUri = /^(https?:\/\/)?(www\.)?(m\.)?(music\.)?(youtube\.com|youtu\.?be)\/.+$/gi.test(currentsong.uri);
            const spUri = /^(https?:\/\/)?(open\.spotify\.com)\/.+$/gi.test(currentsong.uri);
            if (!ytUri && !spUri) {
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_AUTOPLAY_ONLY_YT_SPOTIFY', lang))], flags: v2Flags() });
            }
            if (player.autoplay === true) {
                player.autoplay = false;
                await player.queue.clear();
                await tryUpdateMainPanel(interaction, player, lang, moxi.translate('MUSIC_AUTOPLAY_DISABLED', lang));
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_AUTOPLAY_DISABLED', lang))], flags: v2Flags() });
            } else {
                player.autoplay = true;
                let res;
                if (ytUri) {
                    const identifier = currentsong.identifier;
                    const search = `https://music.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
                    res = await Moxi.poru.resolve({ query: search, source: "ytsearch", requester: interaction.user });
                } else if (spUri) {
                    const search = `artist:${currentsong.author}`;
                    res = await Moxi.poru.resolve({ query: search, source: "spotify", requester: interaction.user });
                }
                if (res && res.tracks.length > 0) {
                    const trackToAdd = res.tracks[Math.floor(Math.random() * Math.min(res.tracks.length, 10))];
                    trackToAdd.info.requester = interaction.user;
                    await player.queue.add(trackToAdd);
                }
                await tryUpdateMainPanel(interaction, player, lang, moxi.translate('MUSIC_AUTOPLAY_ENABLED', lang, { source: ytUri ? 'YouTube' : 'Spotify' }));
                return interaction.editReply({ components: [buildV2Notice(moxi.translate('MUSIC_AUTOPLAY_ENABLED', lang, { source: ytUri ? 'YouTube' : 'Spotify' }))], flags: v2Flags() });
            }
        }

        if (interaction.customId === "vol_up") {
            const lang = await moxi.guildLang(interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const player = Moxi.poru.players.get(interaction.guild.id);
            if (!player) {
                return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() });
            }
            const memberChannel = interaction.member.voice.channelId;
            const botChannel = interaction.guild.members.me.voice.channelId;
            if (!memberChannel || memberChannel !== botChannel) {
                return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_SAME_VOICE_CHANNEL', lang))], flags: v2Flags() });
            }
            const newVol = Math.min(player.volume + 10, 150);
            if (player.volume >= 150) {
                return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_VOLUME_MAX', lang))], flags: v2Flags() });
            }
            player.setVolume(newVol);
            await tryUpdateMainPanel(interaction, player, lang, moxi.translate('MUSIC_CURRENT_VOLUME', lang, { volume: newVol }));
            return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_VOLUME_UP', lang, { vol: newVol }))], flags: v2Flags() });
        }

        // --- BAJAR VOLUMEN ---
        if (interaction.customId === "vol_down") {
            const lang = await moxi.guildLang(interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const player = Moxi.poru.players.get(interaction.guild.id);
            if (!player) {
                return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_NO_MUSIC_PLAYING', lang))], flags: v2Flags() });
            }
            const memberChannel = interaction.member.voice.channelId;
            const botChannel = interaction.guild.members.me.voice.channelId;
            if (!memberChannel || memberChannel !== botChannel) {
                return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_SAME_VOICE_CHANNEL', lang))], flags: v2Flags() });
            }
            const newVol = Math.max(player.volume - 10, 0);
            if (player.volume <= 0) {
                return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_VOLUME_MIN', lang))], flags: v2Flags() });
            }
            player.setVolume(newVol);
            await tryUpdateMainPanel(interaction, player, lang, moxi.translate('MUSIC_CURRENT_VOLUME', lang, { volume: newVol }));
            return safeReply(interaction, { components: [buildV2Notice(moxi.translate('MUSIC_VOLUME_DOWN', lang, { vol: newVol }))], flags: v2Flags() });
        }

    }
});