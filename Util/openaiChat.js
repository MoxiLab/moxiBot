const axios = require('axios');

let blockedUntilMs = 0;
let blockedReason = '';

function nowMs() {
    return Date.now();
}

function getBackoffMs() {
    const raw = Number(process.env.OPENAI_QUOTA_BACKOFF_MS);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return 10 * 60 * 1000; // 10 min
}

function markBlocked(reason, retryAfterMs) {
    const ms = Number.isFinite(Number(retryAfterMs)) && Number(retryAfterMs) > 0
        ? Number(retryAfterMs)
        : getBackoffMs();
    blockedUntilMs = nowMs() + ms;
    blockedReason = String(reason || 'openai_blocked');
}

function isOpenAiTemporarilyBlocked() {
    return nowMs() < blockedUntilMs;
}

function getOpenAiBlockInfo() {
    return {
        blocked: isOpenAiTemporarilyBlocked(),
        untilMs: blockedUntilMs || 0,
        reason: blockedReason || '',
    };
}

function getOpenAiKey() {
    const key = process.env.OPENAI_API_KEY;
    return (typeof key === 'string' && key.trim()) ? key.trim() : '';
}

function getModel() {
    const model = process.env.OPENAI_MODEL;
    return (typeof model === 'string' && model.trim()) ? model.trim() : 'gpt-4o-mini';
}

function resolveModel(override) {
    const m = (typeof override === 'string' && override.trim()) ? override.trim() : '';
    return m || getModel();
}

function clamp(n, min, max) {
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
}

async function chatCompletion({ messages, temperature, model }) {
    if (isOpenAiTemporarilyBlocked()) {
        const info = getOpenAiBlockInfo();
        const seconds = Math.max(0, Math.ceil((info.untilMs - nowMs()) / 1000));
        return { ok: false, error: 'openai_temporarily_blocked', details: `retry_in_${seconds}s` };
    }

    const apiKey = getOpenAiKey();
    if (!apiKey) {
        return { ok: false, error: 'missing_openai_api_key' };
    }

    const chosenModel = resolveModel(model);
    const t = clamp(temperature ?? process.env.OPENAI_TEMPERATURE ?? 0.7, 0, 2);

    try {
        const res = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: chosenModel,
                messages,
                temperature: t,
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: Number(process.env.OPENAI_TIMEOUT_MS) || 30_000,
            }
        );

        const text = res?.data?.choices?.[0]?.message?.content;
        const out = (text === undefined || text === null) ? '' : String(text).trim();
        if (!out) return { ok: false, error: 'empty_response' };
        return { ok: true, text: out, raw: res.data };
    } catch (e) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        const msg = data?.error?.message || e?.message || String(e);

        // Si es cuota excedida o rate limit, evitar spamear llamadas (cortacircuitos)
        if (status === 429) {
            // Puede venir un retry-after (segundos) en headers
            const retryAfterHeader = e?.response?.headers?.['retry-after'];
            const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
            const retryAfterMs = Number.isFinite(retryAfterSeconds) ? (retryAfterSeconds * 1000) : undefined;

            markBlocked('openai_429', retryAfterMs);
        }

        return { ok: false, error: `openai_error_${status || 'unknown'}`, details: msg };
    }
}

module.exports = {
    chatCompletion,
    isOpenAiTemporarilyBlocked,
    getOpenAiBlockInfo,
};
