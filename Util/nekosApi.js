const axios = require('axios');

const NEKOS_API_BASE_URL = process.env.NEKOS_API_BASE_URL || 'https://nekos.best/api/v2';
const NEKOS_API_TIMEOUT_MS = Number(process.env.NEKOS_API_TIMEOUT_MS) || 4500;

async function getRandomNekosGif(category = 'hug') {
    const safeCategory = (category || 'hug').trim();
    const endpoint = `${NEKOS_API_BASE_URL}/${encodeURIComponent(safeCategory)}`;
    try {
        const response = await axios.get(endpoint, {
            timeout: NEKOS_API_TIMEOUT_MS,
        });
        const payload = response?.data;
        if (!payload) return null;
        if (Array.isArray(payload.results) && payload.results.length) {
            return payload.results[0]?.url || null;
        }
        if (Array.isArray(payload.urls) && payload.urls.length) {
            return payload.urls[0] || null;
        }
        return payload.url || null;
    } catch (err) {
        return null;
    }
}

module.exports = {
    getRandomNekosGif,
};
