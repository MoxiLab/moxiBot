const FEATURE_ENV = {
    help: 'HELP_DEBUG',
    prefix: 'PREFIX_DEBUG',
    owner: 'OWNER_DEBUG',
    music: 'MUSIC_DEBUG',
    // Permitir que los logs del módulo de música usen sub-features sin exigir vars extra.
    play: 'MUSIC_DEBUG',
    pause: 'MUSIC_DEBUG',
    resume: 'MUSIC_DEBUG',
    skip: 'MUSIC_DEBUG',
    queue: 'MUSIC_DEBUG',
    autoplay: 'MUSIC_DEBUG',
    stop: 'MUSIC_DEBUG',
    add: 'MUSIC_DEBUG',
    volume: 'MUSIC_DEBUG',
    levels: 'LEVELS_DEBUG',
    welcome: 'WELCOME_DEBUG',
    byes: 'BYES_DEBUG',
    poru: 'PORU_DEBUG',
    lavalink: 'LAVALINK_DEBUG',
    db: 'DB_DEBUG',
    mongo: 'MONGO_DEBUG',
    i18n: 'I18N_DEBUG',
    interaction: 'INTERACTION_DEBUG',
    components: 'COMPONENTS_DEBUG',
    commands: 'COMMANDS_DEBUG',
};

function normalizeEnvValue(value) {
    if (value === true) return '1';
    if (value === false) return '0';
    const raw = String(value ?? '').trim();
    const lower = raw.toLowerCase();
    if (lower === 'true' || lower === 'yes' || lower === 'on') return '1';
    if (lower === 'false' || lower === 'no' || lower === 'off') return '0';
    return raw;
}

function parseList(value) {
    const raw = normalizeEnvValue(value);
    if (!raw) return [];
    return raw
        .split(/[\s,;]+/g)
        .map(s => String(s || '').trim())
        .filter(Boolean);
}

function toDebugEnvKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const upper = raw.toUpperCase();
    if (upper.endsWith('_DEBUG')) return upper;
    const snake = upper
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (!snake) return '';
    return `${snake}_DEBUG`;
}

function resolveEnvKey(featureOrEnvKey) {
    const input = String(featureOrEnvKey || '').trim();
    if (!input) return '';

    const asFeature = input.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(FEATURE_ENV, asFeature)) {
        return FEATURE_ENV[asFeature];
    }

    return toDebugEnvKey(input);
}

function getEnabledFlagsSet() {
    // DEBUG_FLAGS puede contener: help,prefix o HELP_DEBUG,PREFIX_DEBUG o all
    const items = parseList(process.env.DEBUG_FLAGS);
    const set = new Set();
    for (const item of items) {
        const t = String(item).trim();
        if(t) {
            if (t.toLowerCase() === 'all' || t === '*') {
                set.add('*');
            }
            else set.add(resolveEnvKey(t));
        }
    }
    return set;
}

function isGlobalDebugEnabled() {
    const raw = normalizeEnvValue(process.env.DEBUG);
    if (raw === '1') return true;
    if (raw === '0') return false;

    // Conveniencia: en desarrollo (npm run dev / nodemon), habilitar debug por defecto.
    const lifecycle = normalizeEnvValue(process.env.npm_lifecycle_event).toLowerCase();
    if (lifecycle === 'dev') return true;
    const nodeEnv = normalizeEnvValue(process.env.NODE_ENV).toLowerCase();
    if (nodeEnv === 'development') return true;
    return false;
}

function isFlagEnabled(featureOrEnvKey) {
    const envKey = resolveEnvKey(featureOrEnvKey);
    if (!envKey) return isGlobalDebugEnabled();

    // Si se define DEBUG_FLAGS, actuará como filtro/allowlist.
    const enabledFlags = getEnabledFlagsSet();
    const hasFilter = enabledFlags.size > 0;

    // Activación explícita por env key
    const explicit = normalizeEnvValue(process.env[envKey]) === '1';

    // Global DEBUG=1 activa todo, salvo que DEBUG_FLAGS exista y no incluya el flag.
    if (isGlobalDebugEnabled()) {
        if (!hasFilter) return true;
        return enabledFlags.has('*') || enabledFlags.has(envKey);
    }

    // Sin DEBUG global: permitir por envKey=1 o por DEBUG_FLAGS.
    if (explicit) return true;
    if (!hasFilter) return false;
    return enabledFlags.has('*') || enabledFlags.has(envKey);
}

module.exports = {
    FEATURE_ENV,
    normalizeEnvValue,
    parseList,
    resolveEnvKey,
    isGlobalDebugEnabled,
    isFlagEnabled,
};
