const axios = require('axios');

const CACHE_TTL_MS = Number(process.env.WEATHER_CACHE_TTL_MS) || 60_000;
const cache = new Map(); // key -> { value, expiresAt }
const GEO_CACHE_VERSION = 2;

function getWeatherApiKey() {
    const key = process.env.WEATHERAPI_KEY;
    return (typeof key === 'string' && key.trim()) ? key.trim() : '';
}

function toSafeText(value) {
    return (value === undefined || value === null) ? '' : String(value);
}

function fixCommonLocationTypos(input) {
    let s = toSafeText(input);
    // Typos frecuentes
    s = s.replace(/\bDominincana\b/gi, 'Dominicana');
    s = s.replace(/\bDominincano\b/gi, 'Dominicano');
    s = s.replace(/\bRepublica\b/gi, 'República');
    return s;
}

function insertCommaBeforeCountryCue(input) {
    const s = toSafeText(input).trim();
    if (!s || s.includes(',')) return s;

    // Si la ubicación viene como "Ciudad República Dominicana", ayudar a los geocoders
    const cues = /\b(rep[úu]blica|republic|republica)\b/i;
    const idx = s.search(cues);
    if (idx > 0) {
        const left = s.slice(0, idx).trim();
        const right = s.slice(idx).trim();
        if (left && right) return `${left}, ${right}`;
    }
    return s;
}

function buildGeoHintsFromQuery(query) {
    const q = toSafeText(query);
    const qLower = q.toLowerCase();
    const desiredCountries = new Set();

    // Pistas por texto (ES/EN)
    if (qLower.includes('república dominicana') || qLower.includes('republica dominicana') || qLower.includes('dominicana') || qLower.includes('dominican republic')) {
        desiredCountries.add('dominican republic');
    }
    if (qLower.includes('estados unidos') || qLower.includes('united states') || /\busa\b/i.test(qLower)) {
        desiredCountries.add('united states');
    }
    if (qLower.includes('méxico') || qLower.includes('mexico')) {
        desiredCountries.add('mexico');
    }

    // Si viene "Ciudad, País/Región", usar el tramo derecho como pista adicional
    if (q.includes(',')) {
        const right = q.split(',').slice(1).join(',').trim().toLowerCase();
        if (right) desiredCountries.add(right);
    }

    return {
        desiredCountries: Array.from(desiredCountries),
    };
}

function normLocation(s) {
    const fixed = insertCommaBeforeCountryCue(fixCommonLocationTypos(s));
    return toSafeText(fixed)
        .trim()
        .replace(/^en\s+/i, '')
        .replace(/[\?!.。,]+$/g, '')
        .trim();
}

function cacheGet(key) {
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) return hit.value;
    if (hit) cache.delete(key);
    return null;
}

function cacheSet(key, value, ttlMs = CACHE_TTL_MS) {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function wantsTomorrow(text) {
    const t = toSafeText(text).toLowerCase();
    if (!t) return false;
    return /\b(mañana|tomorrow)\b/.test(t);
}

function isWeatherQuestion(text) {
    const t = toSafeText(text).toLowerCase();
    if (!t) return false;
    return /\b(tiempo|clima|weather|temperatura|pron[oó]stico|previsi[oó]n|forecast)\b/.test(t);
}

function weatherCodeToEs(code) {
    const c = Number(code);
    if (!Number.isFinite(c)) return 'Tiempo desconocido';

    // Mapping oficial de Open-Meteo WMO
    if (c === 0) return 'Despejado';
    if (c === 1) return 'Mayormente despejado';
    if (c === 2) return 'Parcialmente nublado';
    if (c === 3) return 'Nublado';

    if (c === 45 || c === 48) return 'Niebla';

    if (c === 51 || c === 53 || c === 55) return 'Llovizna';
    if (c === 56 || c === 57) return 'Llovizna helada';

    if (c === 61 || c === 63 || c === 65) return 'Lluvia';
    if (c === 66 || c === 67) return 'Lluvia helada';

    if (c === 71 || c === 73 || c === 75) return 'Nieve';
    if (c === 77) return 'Granos de nieve';

    if (c === 80 || c === 81 || c === 82) return 'Chubascos';
    if (c === 85 || c === 86) return 'Chubascos de nieve';

    if (c === 95) return 'Tormenta';
    if (c === 96 || c === 99) return 'Tormenta con granizo';

    return 'Tiempo desconocido';
}

async function geocodeLocation(name) {
    const q = normLocation(name);
    if (!q) return null;

    const cacheKey = `geo_v${GEO_CACHE_VERSION}:${q.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const hints = buildGeoHintsFromQuery(q);

    async function fetchBest(query) {
        const url = 'https://geocoding-api.open-meteo.com/v1/search';
        const res = await axios.get(url, {
            params: {
                name: query,
                count: 10,
                language: 'es',
                format: 'json',
            },
            timeout: 15_000,
        });

        const results = res?.data?.results;
        if (!Array.isArray(results) || results.length === 0) return null;

        const desired = hints?.desiredCountries || [];
        const scored = results.map((r, idx) => {
            const country = toSafeText(r?.country).toLowerCase();
            const admin1 = toSafeText(r?.admin1).toLowerCase();
            const nameR = toSafeText(r?.name).toLowerCase();
            let score = 0;

            // Preferencia por país si tenemos pistas
            if (desired.length > 0) {
                const matches = desired.some((d) => {
                    const token = toSafeText(d).toLowerCase().trim();
                    if (!token) return false;
                    return country.includes(token) || admin1.includes(token);
                });
                score += matches ? 100 : -50;
            }

            // Leve preferencia por coincidencia de nombre exacto
            if (nameR === toSafeText(query).toLowerCase()) score += 5;

            // Desempate estable: el orden del proveedor
            score += Math.max(0, 10 - idx) * 0.01;

            return { r, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0]?.r;
        if (!best) return null;

        return {
            name: best.name,
            country: best.country,
            admin1: best.admin1,
            latitude: best.latitude,
            longitude: best.longitude,
            timezone: best.timezone,
        };
    }

    // Intentos: query original, variantes en inglés para países frecuentes, y solo ciudad como último recurso.
    const queries = [q];
    const qLower = q.toLowerCase();
    if (qLower.includes('república dominicana') || qLower.includes('republica dominicana')) {
        queries.push(q.replace(/rep[úu]blica dominicana/ig, 'Dominican Republic'));
    }
    if (qLower.includes('dominicana') && !qLower.includes('dominican republic')) {
        queries.push(q.replace(/dominicana/ig, 'Dominican Republic'));
    }
    // Si viene "Ciudad, País" o "Ciudad País" muy largo, probar solo el primer tramo.
    if (q.includes(',')) {
        const cityOnly = q.split(',')[0].trim();
        if (cityOnly && cityOnly.toLowerCase() !== qLower) queries.push(cityOnly);
    } else {
        const words = q.split(/\s+/).filter(Boolean);
        if (words.length >= 3) {
            // Mantener 2 primeras palabras suele capturar "Santo Domingo", "San Jose", etc.
            const firstTwo = `${words[0]} ${words[1]}`.trim();
            if (firstTwo && firstTwo.toLowerCase() !== qLower) queries.push(firstTwo);
        }
    }

    let out = null;
    for (const query of queries) {
        try {
            out = await fetchBest(query);
            if (out) break;
        } catch {
            // seguimos probando variantes
        }
    }

    if (!out) return null;

    cacheSet(cacheKey, out, 5 * 60_000);
    return out;
}

async function getWeatherApiQuery(textLocation) {
    const loc = normLocation(textLocation);
    if (!loc) return '';

    // Para evitar ambigüedades con nombres repetidos (p.ej. "Santo Domingo"),
    // preferimos pedir coordenadas vía Open-Meteo y consultar WeatherAPI con "lat,lon".
    try {
        const geo = await geocodeLocation(loc);
        if (geo?.latitude !== undefined && geo?.longitude !== undefined) {
            const lat = Number(geo.latitude);
            const lon = Number(geo.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                return `${lat},${lon}`;
            }
        }
    } catch {
        // best-effort
    }

    // Fallback: query por texto
    // Mejorar compatibilidad: algunos países funcionan mejor en inglés en WeatherAPI.
    return loc
        .replace(/rep[úu]blica dominicana/ig, 'Dominican Republic')
        .replace(/estados unidos/ig, 'United States')
        .replace(/reino unido/ig, 'United Kingdom');
}

async function getCurrentWeatherByCoords({ latitude, longitude, timezone }) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const cacheKey = `wx:${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const url = 'https://api.open-meteo.com/v1/forecast';
    const res = await axios.get(url, {
        params: {
            latitude: lat,
            longitude: lon,
            // https://open-meteo.com/en/docs
            current: 'temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,precipitation,weather_code,wind_speed_10m',
            timezone: timezone || 'auto',
        },
        timeout: 15_000,
    });

    const c = res?.data?.current;
    if (!c) return null;

    const out = {
        time: c.time,
        temperatureC: c.temperature_2m,
        feelsLikeC: c.apparent_temperature,
        humidityPct: c.relative_humidity_2m,
        cloudCoverPct: c.cloud_cover,
        precipitationMm: c.precipitation,
        windKmh: c.wind_speed_10m,
        weatherCode: c.weather_code,
        weatherTextEs: weatherCodeToEs(c.weather_code),
    };

    cacheSet(cacheKey, out, CACHE_TTL_MS);
    return out;
}

async function getTomorrowForecastByCoords({ latitude, longitude, timezone }) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const cacheKey = `wx_tomorrow:${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const url = 'https://api.open-meteo.com/v1/forecast';
    const res = await axios.get(url, {
        params: {
            latitude: lat,
            longitude: lon,
            // https://open-meteo.com/en/docs
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,sunrise,sunset,wind_speed_10m_max',
            timezone: timezone || 'auto',
            forecast_days: 2,
        },
        timeout: 15_000,
    });

    const d = res?.data?.daily;
    const time = d?.time?.[1];
    if (!d || !time) return null;

    const code = d.weather_code?.[1];
    const out = {
        date: time,
        weatherCode: code,
        weatherTextEs: weatherCodeToEs(code),
        tempMaxC: d.temperature_2m_max?.[1],
        tempMinC: d.temperature_2m_min?.[1],
        precipitationSumMm: d.precipitation_sum?.[1],
        precipitationProbMaxPct: d.precipitation_probability_max?.[1],
        uvIndexMax: d.uv_index_max?.[1],
        sunrise: d.sunrise?.[1],
        sunset: d.sunset?.[1],
        windMaxKmh: d.wind_speed_10m_max?.[1],
    };

    cacheSet(cacheKey, out, CACHE_TTL_MS);
    return out;
}

function extractLocationFromText(text) {
    const t = toSafeText(text).trim();
    if (!t) return '';

    // "que tiempo hace en toronto canada" / "mañana en madrid" / "pronóstico en madrid"
    const m = t.match(/\b(?:en|in)\s+([^\n]+)$/i);
    if (m && m[1]) return normLocation(m[1]);

    // "tiempo toronto"
    const m2 = t.match(/\b(?:tiempo|clima|weather)\b\s+(.+)$/i);
    if (m2 && m2[1]) return normLocation(m2[1]);

    // "mañana madrid" / "tomorrow madrid" (sin 'en')
    const m3 = t.match(/\b(?:mañana|tomorrow)\b\s+(?:en\s+)?(.+)$/i);
    if (m3 && m3[1]) return normLocation(m3[1]);

    return '';
}

async function getWeatherFromWeatherApi(text) {
    const apiKey = getWeatherApiKey();
    if (!apiKey) return { ok: false, reason: 'missing_weatherapi_key' };

    const loc = extractLocationFromText(text);
    if (!loc) return { ok: false, reason: 'missing_location' };

    const weatherApiQ = await getWeatherApiQuery(loc);
    if (!weatherApiQ) return { ok: false, reason: 'missing_location' };

    const wantTomorrow = wantsTomorrow(text);
    const cacheKey = `weatherapi:${wantTomorrow ? 'tomorrow' : 'current'}:${loc.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
        if (wantTomorrow) {
            const url = 'https://api.weatherapi.com/v1/forecast.json';
            const res = await axios.get(url, {
                params: {
                    key: apiKey,
                    q: weatherApiQ,
                    days: 2,
                    aqi: 'no',
                    alerts: 'no',
                    lang: 'es',
                },
                timeout: 15_000,
            });

            const locationName = res?.data?.location?.name;
            const region = res?.data?.location?.region;
            const country = res?.data?.location?.country;
            const place = [locationName, region, country].filter(Boolean).join(', ');

            const tomorrow = res?.data?.forecast?.forecastday?.[1];
            const day = tomorrow?.day;
            const astro = tomorrow?.astro;
            if (!tomorrow || !day) return { ok: false, reason: 'forecast_unavailable' };

            const out = {
                ok: true,
                kind: 'tomorrow',
                location: place || loc,
                date: tomorrow.date,
                weatherTextEs: day?.condition?.text,
                tempMaxC: day?.maxtemp_c,
                tempMinC: day?.mintemp_c,
                precipitationSumMm: day?.totalprecip_mm,
                precipitationProbMaxPct: day?.daily_chance_of_rain,
                windMaxKmh: day?.maxwind_kph,
                uvIndexMax: day?.uv,
                sunrise: astro?.sunrise,
                sunset: astro?.sunset,
            };

            cacheSet(cacheKey, out, CACHE_TTL_MS);
            return out;
        }

        const url = 'https://api.weatherapi.com/v1/current.json';
        const res = await axios.get(url, {
            params: {
                key: apiKey,
                q: weatherApiQ,
                aqi: 'no',
                lang: 'es',
            },
            timeout: 15_000,
        });

        const locationName = res?.data?.location?.name;
        const region = res?.data?.location?.region;
        const country = res?.data?.location?.country;
        const place = [locationName, region, country].filter(Boolean).join(', ');

        const c = res?.data?.current;
        if (!c) return { ok: false, reason: 'weather_unavailable' };

        const out = {
            ok: true,
            kind: 'current',
            location: place || loc,
            time: res?.data?.location?.localtime,
            weatherTextEs: c?.condition?.text,
            temperatureC: c?.temp_c,
            feelsLikeC: c?.feelslike_c,
            humidityPct: c?.humidity,
            cloudCoverPct: c?.cloud,
            windKmh: c?.wind_kph,
            precipitationMm: c?.precip_mm,
        };

        cacheSet(cacheKey, out, CACHE_TTL_MS);
        return out;
    } catch {
        return { ok: false, reason: 'weatherapi_failed' };
    }
}

async function getWeatherForText(text) {
    if (!isWeatherQuestion(text)) return { ok: false, reason: 'not_weather' };

    // Preferir WeatherAPI si hay API key configurada.
    const apiKey = getWeatherApiKey();
    if (apiKey) {
        const res = await getWeatherFromWeatherApi(text);
        if (res?.ok) return res;
        // Si falla WeatherAPI por cualquier razón, hacemos fallback a Open-Meteo.
    }

    const loc = extractLocationFromText(text);
    if (!loc) return { ok: false, reason: 'missing_location' };

    const geo = await geocodeLocation(loc);
    if (!geo) return { ok: false, reason: 'location_not_found' };

    // Si preguntan por mañana, devolvemos el pronóstico.
    if (wantsTomorrow(text)) {
        const fc = await getTomorrowForecastByCoords(geo);
        if (!fc) return { ok: false, reason: 'forecast_unavailable' };

        const place = [geo.name, geo.admin1, geo.country].filter(Boolean).join(', ');
        return {
            ok: true,
            kind: 'tomorrow',
            location: place,
            ...fc,
        };
    }

    const wx = await getCurrentWeatherByCoords(geo);
    if (!wx) return { ok: false, reason: 'weather_unavailable' };

    const place = [geo.name, geo.admin1, geo.country].filter(Boolean).join(', ');
    return {
        ok: true,
        kind: 'current',
        location: place,
        ...wx,
    };
}

function formatWeatherReplyEs(result) {
    if (!result?.ok) return '';
    const parts = [];

    const formatSunTime = (value) => {
        const s = toSafeText(value).trim();
        if (!s) return '';
        // Open-Meteo: '2026-02-02T07:55' | WeatherAPI: '06:58 AM'
        if (s.includes('T') && s.length >= 16) return s.slice(11, 16);
        return s;
    };

    if (result.kind === 'tomorrow') {
        parts.push(`Pronóstico para **mañana** en **${result.location}** (${result.date}):`);
        if (result.weatherTextEs) parts.push(`- ${result.weatherTextEs}`);
        if (result.tempMaxC !== undefined || result.tempMinC !== undefined) {
            const max = (result.tempMaxC !== undefined) ? `${Math.round(result.tempMaxC)}°C` : '?';
            const min = (result.tempMinC !== undefined) ? `${Math.round(result.tempMinC)}°C` : '?';
            parts.push(`- Temp: **máx ${max} / mín ${min}**`);
        }
        if (result.windMaxKmh !== undefined) parts.push(`- Viento máx: ${Math.round(result.windMaxKmh)} km/h`);
        if (result.precipitationProbMaxPct !== undefined) parts.push(`- Prob. lluvia (máx): ${Math.round(result.precipitationProbMaxPct)}%`);
        if (result.precipitationSumMm !== undefined) parts.push(`- Precipitación total: ${result.precipitationSumMm} mm`);
        if (result.uvIndexMax !== undefined) parts.push(`- UV máx: ${result.uvIndexMax}`);
        if (result.sunrise || result.sunset) {
            // WeatherAPI devuelve '06:58 AM' y Open-Meteo devuelve ISO.
            const rise = formatSunTime(result.sunrise) || '?';
            const set = formatSunTime(result.sunset) || '?';
            parts.push(`- Sol: ${rise}–${set}`);
        }
        return parts.join('\n');
    }

    parts.push(`Tiempo en **${result.location}**:`);
    if (result.weatherTextEs) parts.push(`- ${result.weatherTextEs}`);
    if (result.temperatureC !== undefined) parts.push(`- Temp: **${Math.round(result.temperatureC)}°C** (sensación: ${Math.round(result.feelsLikeC)}°C)`);
    if (result.humidityPct !== undefined) parts.push(`- Humedad: ${Math.round(result.humidityPct)}%`);
    if (result.cloudCoverPct !== undefined) parts.push(`- Nubosidad: ${Math.round(result.cloudCoverPct)}%`);
    if (result.windKmh !== undefined) parts.push(`- Viento: ${Math.round(result.windKmh)} km/h`);
    if (result.precipitationMm !== undefined) parts.push(`- Precipitación: ${result.precipitationMm} mm`);
    if (result.time) parts.push(`- Hora local: ${result.time}`);
    return parts.join('\n');
}

module.exports = {
    isWeatherQuestion,
    getWeatherForText,
    formatWeatherReplyEs,
};
