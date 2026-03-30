const axios = require('axios');
const ffmpegPath = require('ffmpeg-static');
const prism = require('prism-media');
const debugHelper = require('./debugHelper');
const { Readable } = require('node:stream');

const {
    AudioPlayerStatus,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
    StreamType,
} = require('@discordjs/voice');

function sanitizeVoiceName(v) {
    const raw = (v === undefined || v === null) ? '' : String(v).trim();
    if (!raw) return '';
    return raw.replace(/[^a-z0-9_-]/gi, '').slice(0, 32);
}

function splitTtsText(text) {
    const raw = (text === undefined || text === null) ? '' : String(text).trim();
    if (!raw) return [];
    const maxLen = Number.parseInt(process.env.TTS_MAX_CHARS || '', 10) || 200;
    if (raw.length <= maxLen) return [raw];

    const chunks = [];
    let rest = raw;
    while (rest.length) {
        if (rest.length <= maxLen) {
            chunks.push(rest.trim());
            break;
        }
        const window = rest.slice(0, maxLen);
        const cut = Math.max(
            window.lastIndexOf('. '),
            window.lastIndexOf('! '),
            window.lastIndexOf('? '),
            window.lastIndexOf(', '),
            window.lastIndexOf('; '),
            window.lastIndexOf(': ')
        );
        const idx = (cut >= Math.floor(maxLen * 0.33)) ? (cut + 1) : maxLen;
        chunks.push(rest.slice(0, idx).trim());
        rest = rest.slice(idx).trim();
        if (chunks.length >= 6) {
            if (rest) chunks.push(rest.slice(0, maxLen).trim());
            break;
        }
    }

    return chunks.filter(Boolean);
}

function buildStreamElementsUrl({ text, voice }) {
    const v = sanitizeVoiceName(voice) || sanitizeVoiceName(process.env.TTS_VOICE) || 'Brian';
    const maxLen = Number.parseInt(process.env.TTS_MAX_CHARS || '', 10) || 200;
    const t = String(text || '').trim().slice(0, maxLen);
    const qs = new URLSearchParams({ voice: v, text: t });
    return `https://api.streamelements.com/kappa/v2/speech?${qs.toString()}`;
}

function buildGoogleTranslateTtsUrl({ text, lang }) {
    const maxLen = Number.parseInt(process.env.TTS_MAX_CHARS || '', 10) || 200;
    const tl = (lang || process.env.TTS_LANG || 'es').toString().trim() || 'es';
    const t = String(text || '').trim().slice(0, maxLen);
    const qs = new URLSearchParams({
        ie: 'UTF-8',
        client: 'tw-ob',
        tl,
        q: t,
    });
    return `https://translate.google.com/translate_tts?${qs.toString()}`;
}

function buildTtsUrl({ text, voice }) {
    const provider = String(process.env.TTS_PROVIDER || 'google').trim().toLowerCase();
    if (provider === 'streamelements' || provider === 'se') {
        return buildStreamElementsUrl({ text, voice });
    }
    return buildGoogleTranslateTtsUrl({ text, lang: process.env.TTS_LANG || 'es' });
}
 
const guildSessions = new Map();  

async function ensureConnection({ guild, voiceChannel, selfDeaf = true }) {
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf,
    });

    // Esperar READY o fallar.
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    return connection;
}

function createPcmResourceFromMp3Stream(inputStream) {
    // MP3 -> PCM s16le 48kHz 2ch
    const transcoder = new prism.FFmpeg({
        executable: ffmpegPath || 'ffmpeg',
        args: [
            '-hide_banner',
            '-loglevel', 'error',
            '-analyzeduration', '0',
            '-probesize', '32k',
            '-f', 'mp3',
            '-i', 'pipe:0',
            '-vn',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
        ],
    });

    inputStream.pipe(transcoder);

    return createAudioResource(transcoder, {
        inputType: StreamType.Raw,
    });
}

async function fetchTtsMp3Stream(url) {
    // Nota: StreamElements responde 401 si se pide como stream en Node,
    // pero suele funcionar como arraybuffer. Convertimos a Readable.
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20_000,
        maxRedirects: 5,
        headers: {
            // StreamElements a veces devuelve 401 si no hay User-Agent
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        },
        validateStatus: (s) => s >= 200 && s < 400,
    });

    if (!res || !res.data) {
        throw new Error('Respuesta TTS inválida (sin data)');
    }

    const buf = Buffer.isBuffer(res.data) ? res.data : Buffer.from(res.data);
    if (!buf || buf.length === 0) {
        throw new Error('Respuesta TTS vacía');
    }

    return Readable.from(buf);
}

function cleanupGuild(guildId) {
    const session = guildSessions.get(guildId);
    if (!session) return;

    try { session.player?.stop?.(true); } catch { /* noop */ }
    try { session.connection?.destroy?.(); } catch { /* noop */ }

    if (session.idleTimer) clearTimeout(session.idleTimer);
    guildSessions.delete(guildId);
}

function armIdleDisconnect(guildId, ms = 15_000) {
    const session = guildSessions.get(guildId);
    if (!session) return;
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = setTimeout(() => cleanupGuild(guildId), ms);
}

async function playQueue(guildId) {
    const session = guildSessions.get(guildId);
    if (!session) return;
    if (session.player.state.status !== AudioPlayerStatus.Idle) return;

    let lastErr = null;
    while (session.queue.length) {
        const next = session.queue.shift();
        if (!next) break;
        try {
            const stream = await fetchTtsMp3Stream(next);
            stream.on('error', (e) => {
                debugHelper?.error?.('tts-voice', 'tts stream error', e);
            });

            const resource = createPcmResourceFromMp3Stream(stream);
            session.player.play(resource);
            return { played: true };
        } catch (err) {
            lastErr = err;
            debugHelper?.warn?.('tts-voice', 'tts chunk failed', err);
        }
    }

    armIdleDisconnect(guildId);
    return { played: false, error: lastErr };
}

async function speakInVoice({ guild, member, text, voice }) {
    if (!guild) throw new Error('No guild');
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) throw new Error('Debes estar en un canal de voz.');

    const guildId = guild.id;
    const chunks = splitTtsText(text);
    if (!chunks.length) throw new Error('Mensaje vacío.');

    let session = guildSessions.get(guildId);

    if (!session) {
        const connection = await ensureConnection({ guild, voiceChannel, selfDeaf: true });
        const player = createAudioPlayer();

        connection.subscribe(player);

        session = { connection, player, queue: [], idleTimer: null };
        guildSessions.set(guildId, session);

        player.on(AudioPlayerStatus.Idle, () => {
            playQueue(guildId);
        });

        player.on('error', (e) => {
            debugHelper?.error?.('tts-voice', 'audio player error', e);
            // Intentar siguiente elemento de cola
            setImmediate(() => playQueue(guildId));
        });

        connection.on(VoiceConnectionStatus.Disconnected, () => {
            // Si se desconecta, limpiar.
            cleanupGuild(guildId);
        });

        connection.on('error', () => cleanupGuild(guildId));
    } else {
        // Si ya hay sesión pero está en otro canal, la recreamos.
        const currentChannelId = session.connection?.joinConfig?.channelId;
        if (currentChannelId && String(currentChannelId) !== String(voiceChannel.id)) {
            cleanupGuild(guildId);
            return speakInVoice({ guild, member, text, voice });
        }
    }

    // Encolar URLs por chunk
    for (const chunk of chunks) {
        const url = buildTtsUrl({ text: chunk, voice });
        session.queue.push(url);
    }

    // Si estaba idle, reproducir ya y si todo falla, propagar error
    if (session.player.state.status === AudioPlayerStatus.Idle) {
        const r = await playQueue(guildId);
        if (r && r.played === false) {
            const msg = (r.error && r.error.message) ? r.error.message : 'No pude generar el audio TTS.';
            throw new Error(msg);
        }
    }

    // Si estaba sonando, simplemente queda en cola
    return { queued: chunks.length };
}

module.exports = {
    speakInVoice,
    // Exportados para reutilizar el mismo proveedor en canales de texto
    buildTtsUrl,
    buildStreamElementsUrl,
    buildGoogleTranslateTtsUrl,
    splitTtsText,
    fetchTtsMp3Stream,
};
