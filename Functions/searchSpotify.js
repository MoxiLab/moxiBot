const axios = require("axios");

/* ====================== LOG BONITO ====================== */
function log(level, msg) {
    const t = new Date().toISOString().replace("T", " ").split(".")[0];
    const c = { INFO: "\x1b[36m", OK: "\x1b[32m", WARN: "\x1b[33m", ERROR: "\x1b[31m", RESET: "\x1b[0m" };
    console.log(`${c.RESET}[${t}] [Spotify][${c[level]}${level}${c.RESET}] ${msg}`);
}

/* ====================== TOKEN CACHE ====================== */

let cachedToken = null;
let tokenExpirationTime = 0;

async function getToken() {
    const now = Date.now();

    if (cachedToken && now < tokenExpirationTime) return cachedToken;

    log("INFO", "Renovando token de Spotify...");

    const result = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({ grant_type: "client_credentials" }),
        {
            headers: {
                Authorization:
                    "Basic " +
                    Buffer.from(
                        process.env.SPOTIFY_CLIENT_ID +
                        ":" +
                        process.env.SPOTIFY_CLIENT_SECRET
                    ).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );

    cachedToken = result.data.access_token;
    tokenExpirationTime = now + result.data.expires_in * 1000 - 60_000;

    log("OK", "Token renovado correctamente.");
    return cachedToken;
}

/* ====================== FORMATEO DE TRACK ====================== */

function formatTrack(t) {
    return {
        trackUrl: t.external_urls.spotify,
        id: t.id,
        name: t.name,
        author: t.artists.map(a => a.name).join(", "),
        duration: t.duration_ms,
        image: t.album.images?.[0]?.url || "",
    };
}

/* ====================== FALLBACK INTELIGENTE ====================== */

async function fallbackSearch(trackName, artistName, token) {
    log("WARN", "Usando fallback inteligente (búsqueda)…");

    const query = `${artistName} ${trackName}`;

    try {
        const res = await axios.get("https://api.spotify.com/v1/search", {
            headers: { Authorization: `Bearer ${token}` },
            params: { q: query, type: "track", limit: 10 }
        });

        const items = res.data.tracks.items ?? [];
        log("OK", `Fallback encontró ${items.length} resultados.`);

        return items.map(formatTrack);
    } catch {
        log("ERROR", "Fallback también falló.");
        return [];
    }
}

/* ====================== FUNCIÓN PRINCIPAL ====================== */

async function getRecommendations(trackId) {
    try {
        const token = await getToken();

        /* 1️⃣ VERIFICAR QUE EL TRACK EXISTE */
        const info = await axios
            .get(`https://api.spotify.com/v1/tracks/${trackId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            .catch(() => null);

        if (!info?.data) {
            log("ERROR", "Track no encontrado → Spotify API devolvió 404 real.");
            return [];
        }

        const trackName = info.data.name;
        const artistName = info.data.artists[0].name;

        /* 2️⃣ RECOMENDACIONES NATIVAS */
        log("INFO", `Obteniendo recomendaciones nativas para ID: ${trackId}`);

        let recs;

        try {
            const res = await axios.get("https://api.spotify.com/v1/recommendations", {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    limit: 10,
                    seed_tracks: trackId,
                    market: "US"
                }
            });

            recs = res.data.tracks;

        } catch (e) {
            log("WARN", "API de recomendaciones falló → usando fallback.");
            return fallbackSearch(trackName, artistName, token);
        }

        if (!recs || recs.length === 0) {
            log("WARN", "Nativas devolvieron 0 → fallback.");
            return fallbackSearch(trackName, artistName, token);
        }

        const final = recs.map(formatTrack);
        log("OK", `Recomendaciones obtenidas: ${final.length}`);

        return final;

    } catch (e) {
        log("ERROR", `Error inesperado: ${e.message}`);
        return [];
    }
}

module.exports = { getRecommendations };
