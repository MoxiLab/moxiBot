const {
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');

const { Bot } = require('../Config');
const moxi = require('../i18n');
const { EMOJIS } = require('./emojis');
const { getItemById } = require('./inventoryCatalog');

const COIN = EMOJIS.coin || '\u{1FA99}'; // 🪙

function safeInt(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.trunc(x);
}

function normalizeKey(input) {
    return String(input || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, '-');
}

function hasInventoryItem(economyDoc, itemId) {
    const inv = Array.isArray(economyDoc?.inventory) ? economyDoc.inventory : [];
    return inv.some((it) => it?.itemId === itemId && safeInt(it?.amount, 0) > 0);
}

function itemLabel(itemId, lang) {
    const item = getItemById(itemId, { lang });
    return item?.name ? `**${item.name}**` : `**${itemId}**`;
}

const FISH_ZONES = Object.freeze([
    // Zonas básicas (requieren caña)
    {
        id: 'muelle-moxi',
        name: 'Muelle de Moxi',
        emoji: '🎣',
        requiredItemId: 'herramientas/cana-de-pesca-moxi',
        reward: { min: 35, max: 80 },
        aliases: ['muelle', 'dock'],
    },
    {
        id: 'rio-de-luciernagas',
        name: 'Río de Luciérnagas',
        emoji: '✨',
        requiredItemId: 'herramientas/cana-de-pesca-moxi',
        reward: { min: 45, max: 95 },
        aliases: ['rio', 'luciernagas'],
    },
    {
        id: 'laguna-celeste',
        name: 'Laguna Celeste',
        emoji: '💧',
        requiredItemId: 'herramientas/cana-de-pesca-moxi',
        reward: { min: 55, max: 120 },
        aliases: ['laguna', 'celeste'],
    },
    {
        id: 'pantano-prisma',
        name: 'Pantano Prisma',
        emoji: '🪷',
        requiredItemId: 'herramientas/cana-de-pesca-moxi',
        reward: { min: 70, max: 150 },
        aliases: ['pantano', 'swamp'],
    },
    {
        id: 'cascada-de-cristal',
        name: 'Cascada de Cristal',
        emoji: '🫧',
        requiredItemId: 'herramientas/cana-de-pesca-moxi',
        reward: { min: 85, max: 185 },
        aliases: ['cascada', 'cristal'],
    },
    {
        id: 'lago-invernal',
        name: 'Lago Invernal',
        emoji: '🧊',
        requiredItemId: 'herramientas/cana-de-pesca-moxi',
        reward: { min: 95, max: 210 },
        aliases: ['invernal', 'lago'],
    },
    {
        id: 'canal-urbano',
        name: 'Canal Urbano',
        emoji: '🧱',
        requiredItemId: 'herramientas/cana-de-pesca-moxi',
        reward: { min: 75, max: 170 },
        aliases: ['canal', 'urbano'],
    },
    {
        id: 'estanque-jardin',
        name: 'Estanque del Jardín',
        emoji: '🌿',
        requiredItemId: 'herramientas/cana-de-pesca-moxi',
        reward: { min: 50, max: 110 },
        aliases: ['estanque', 'jardin'],
    },
    {
        id: 'ribera-del-viento',
        name: 'Ribera del Viento',
        emoji: '🌬️',
        requiredItemId: 'herramientas/cana-de-pesca-moxi',
        reward: { min: 90, max: 205 },
        aliases: ['ribera', 'viento'],
    },

    // Zonas marítimas (requieren barco)
    {
        id: 'bahia-sakura',
        name: 'Bahía Sakura',
        emoji: '🌸',
        requiredItemId: 'herramientas/barco-moxi',
        reward: { min: 110, max: 230 },
        aliases: ['bahia', 'sakura'],
    },
    {
        id: 'arrecife-arcoiris',
        name: 'Arrecife Arcoíris',
        emoji: '🌈',
        requiredItemId: 'herramientas/barco-moxi',
        reward: { min: 130, max: 260 },
        aliases: ['arrecife', 'reef'],
    },
    {
        id: 'mar-de-azur',
        name: 'Mar de Azur',
        emoji: '🌊',
        requiredItemId: 'herramientas/barco-moxi',
        reward: { min: 150, max: 290 },
        aliases: ['azur', 'mar'],
    },
    {
        id: 'islas-perdidas',
        name: 'Islas Perdidas',
        emoji: '🏝️',
        requiredItemId: 'herramientas/barco-moxi',
        reward: { min: 170, max: 320 },
        aliases: ['islas', 'perdidas'],
    },
    {
        id: 'corriente-negra',
        name: 'Corriente Negra',
        emoji: '🖤',
        requiredItemId: 'herramientas/barco-moxi',
        reward: { min: 190, max: 360 },
        aliases: ['corriente', 'negra'],
    },
    {
        id: 'mar-de-espuma',
        name: 'Mar de Espuma',
        emoji: '🫧',
        requiredItemId: 'herramientas/barco-moxi',
        reward: { min: 160, max: 320 },
        aliases: ['espuma'],
    },
    {
        id: 'estrecho-tormenta',
        name: 'Estrecho de la Tormenta',
        emoji: '⛈️',
        requiredItemId: 'herramientas/barco-moxi',
        reward: { min: 210, max: 390 },
        aliases: ['estrecho', 'tormenta'],
    },
    {
        id: 'trinchera-azabache',
        name: 'Trinchera Azabache',
        emoji: '🕳️',
        requiredItemId: 'herramientas/barco-moxi',
        reward: { min: 240, max: 470 },
        aliases: ['trinchera', 'azabache'],
    },
    {
        id: 'mar-de-estrellas',
        name: 'Mar de Estrellas',
        emoji: '🌟',
        requiredItemId: 'herramientas/barco-moxi',
        reward: { min: 200, max: 410 },
        aliases: ['estrellas'],
    },

    // Zonas oscuras (requieren linterna)
    {
        id: 'cueva-humedad',
        name: 'Cueva de la Humedad',
        emoji: '🕯️',
        requiredItemId: 'buffs/linterna-solar',
        reward: { min: 120, max: 250 },
        aliases: ['cueva', 'humedad'],
    },
    {
        id: 'gruta-del-eco',
        name: 'Gruta del Eco',
        emoji: '🔊',
        requiredItemId: 'buffs/linterna-solar',
        reward: { min: 140, max: 280 },
        aliases: ['gruta', 'eco'],
    },
    {
        id: 'pozo-sombras',
        name: 'Pozo de Sombras',
        emoji: '🌑',
        requiredItemId: 'buffs/linterna-solar',
        reward: { min: 160, max: 310 },
        aliases: ['pozo', 'sombras'],
    },
    {
        id: 'abismo-murmullos',
        name: 'Abismo de los Murmullos',
        emoji: '🫥',
        requiredItemId: 'buffs/linterna-solar',
        reward: { min: 180, max: 340 },
        aliases: ['abismo', 'murmullos'],
    },
    {
        id: 'galeria-silenciosa',
        name: 'Galería Silenciosa',
        emoji: '🤫',
        requiredItemId: 'buffs/linterna-solar',
        reward: { min: 170, max: 330 },
        aliases: ['galeria', 'silenciosa'],
    },
    {
        id: 'tunel-de-onix',
        name: 'Túnel de Ónix',
        emoji: '🖤',
        requiredItemId: 'buffs/linterna-solar',
        reward: { min: 200, max: 380 },
        aliases: ['tunel', 'onix'],
    },
    {
        id: 'fosa-nebulosa',
        name: 'Fosa Nebulosa',
        emoji: '🌫️',
        requiredItemId: 'buffs/linterna-solar',
        reward: { min: 210, max: 400 },
        aliases: ['fosa', 'nebulosa'],
    },

    // Zonas bloqueadas (requieren dinamita)
    {
        id: 'caverna-sellada',
        name: 'Caverna Sellada',
        emoji: '⛏️',
        requiredItemId: 'herramientas/dinamita',
        reward: { min: 220, max: 420 },
        aliases: ['sellada', 'caverna'],
    },
    {
        id: 'tuberias-oxidadas',
        name: 'Tuberías Oxidadas',
        emoji: '🧰',
        requiredItemId: 'herramientas/dinamita',
        reward: { min: 240, max: 460 },
        aliases: ['tuberias', 'oxidadas'],
    },
    {
        id: 'presa-fracturada',
        name: 'Presa Fracturada',
        emoji: '🧨',
        requiredItemId: 'herramientas/dinamita',
        reward: { min: 260, max: 520 },
        aliases: ['presa', 'fracturada'],
    },
    {
        id: 'compuertas-antiguas',
        name: 'Compuertas Antiguas',
        emoji: '🚪',
        requiredItemId: 'herramientas/dinamita',
        reward: { min: 280, max: 560 },
        aliases: ['compuertas', 'antiguas'],
    },

    // Zonas de tesoro (requieren revelador)
    {
        id: 'playa-brillante',
        name: 'Playa Brillante',
        emoji: '🏖️',
        requiredItemId: 'herramientas/revelador-prisma',
        reward: { min: 160, max: 420 },
        aliases: ['playa', 'brillante'],
    },
    {
        id: 'ruinas-sumergidas',
        name: 'Ruinas Sumergidas',
        emoji: '🏛️',
        requiredItemId: 'herramientas/revelador-prisma',
        reward: { min: 200, max: 520 },
        aliases: ['ruinas', 'sumergidas'],
    },
    {
        id: 'santuario-lunar',
        name: 'Santuario Lunar',
        emoji: '🌙',
        requiredItemId: 'herramientas/revelador-prisma',
        reward: { min: 230, max: 600 },
        aliases: ['santuario', 'lunar'],
    },
    {
        id: 'jardin-sumergido',
        name: 'Jardín Sumergido',
        emoji: '🪸',
        requiredItemId: 'herramientas/revelador-prisma',
        reward: { min: 210, max: 560 },
        aliases: ['jardin-sumergido', 'jardin'],
    },
    {
        id: 'biblioteca-hundida',
        name: 'Biblioteca Hundida',
        emoji: '📚',
        requiredItemId: 'herramientas/revelador-prisma',
        reward: { min: 240, max: 650 },
        aliases: ['biblioteca', 'hundida'],
    },

    // Automático (gólem)
    {
        id: 'delta-automatizado',
        name: 'Delta Automatizado',
        emoji: '🤖',
        requiredItemId: 'herramientas/golem-minero-pescador',
        reward: { min: 180, max: 380 },
        aliases: ['delta', 'automatizado', 'golem'],
    },
    {
        id: 'muelle-industrial',
        name: 'Muelle Industrial',
        emoji: '🏗️',
        requiredItemId: 'herramientas/golem-minero-pescador',
        reward: { min: 210, max: 440 },
        aliases: ['industrial'],
    },
]);

function resolveFishZone(input) {
    const key = normalizeKey(input);
    if (!key) return null;
    return (
        FISH_ZONES.find((z) => z.id === key) ||
        FISH_ZONES.find((z) => Array.isArray(z.aliases) && z.aliases.map(normalizeKey).includes(key)) ||
        null
    );
}

function clampInt(n, min, max) {
    const x = Number.parseInt(String(n), 10);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
}

function buildFishNavButtons({ userId, page, totalPages, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const p = clampInt(page, 0, Math.max(0, (totalPages || 1) - 1));

    const prev = new ButtonBuilder()
        .setCustomId(`fish:prev:${safeUserId}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.arrowLeft)
        .setDisabled(disabled || p <= 0);

    const refresh = new ButtonBuilder()
        .setCustomId(`fish:refresh:${safeUserId}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔁')
        .setDisabled(disabled);

    const close = new ButtonBuilder()
        .setCustomId(`fish:close:${safeUserId}:${p}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(EMOJIS.cross)
        .setDisabled(disabled);

    const help = new ButtonBuilder()
        .setCustomId(`fish:help:${safeUserId}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.question)
        .setDisabled(disabled);

    const next = new ButtonBuilder()
        .setCustomId(`fish:next:${safeUserId}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.arrowRight)
        .setDisabled(disabled || p >= (totalPages - 1));

    return [prev, refresh, close, help, next];
}

function buildFishPickButtons({ userId, page, zones, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const p = clampInt(page, 0, 999);
    const slice = Array.isArray(zones) ? zones : [];

    return slice.map((z, index) =>
        new ButtonBuilder()
            .setCustomId(`fish:pick:${safeUserId}:${p}:${index}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(z?.emoji || '🎣')
            .setLabel(String(z?.id || `zona-${index + 1}`))
            .setDisabled(disabled)
    );
}

function getZonesPage({ page = 0, perPage = 5 } = {}) {
    const safePerPage = Math.max(1, Math.min(5, safeInt(perPage, 5)));
    const totalPages = Math.max(1, Math.ceil(FISH_ZONES.length / safePerPage));
    const p = clampInt(page, 0, totalPages - 1);
    const start = p * safePerPage;
    const slice = FISH_ZONES.slice(start, start + safePerPage);
    return { page: p, perPage: safePerPage, totalPages, slice };
}

function getZoneForPick({ page, index, perPage = 5 } = {}) {
    const { slice } = getZonesPage({ page, perPage });
    const i = clampInt(index, 0, Math.max(0, slice.length - 1));
    return slice[i] || null;
}

function buildFishZonesContainer({ lang = 'es-ES', userId, page = 0, perPage = 5, disabledButtons = false } = {}) {
    const { page: p, totalPages, slice } = getZonesPage({ page, perPage });
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
    const tz = (k, vars = {}) => moxi.translate(`economy/zones:${k}`, safeLang, vars);

    function fishZoneLabel(z) {
        const id = String(z?.id || '').trim();
        if (!id) return z?.name || '—';
        const key = `economy/zones:fish.${id}`;
        const res = moxi.translate(key, safeLang);
        if (res && res !== key) {
            const idx = key.indexOf(':');
            const keyPath = (idx >= 0) ? key.slice(idx + 1) : '';
            if (!keyPath || res !== keyPath) return res;
        }
        const pretty = id
            .split('-')
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        return pretty || z?.name || id;
    }

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(t => t.setContent(tz('ui.page', { page: p + 1, total: totalPages }) || `Page ${p + 1} of ${totalPages}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(tz('ui.fishTitle') || '## Fish • Zones'));

    for (const z of slice) {
        const displayZone = fishZoneLabel(z);
        const requiredLabel = tz('ui.requires', { item: itemLabel(z.requiredItemId, safeLang) }) || `Requires: ${itemLabel(z.requiredItemId, safeLang)}`;
        container
            .addTextDisplayComponents(t =>
                t.setContent(
                    `${z.emoji || '🎣'} **${z.id}** — ${displayZone}\n` +
                    requiredLabel
                )
            )
            .addSeparatorComponents(s => s.setDivider(true));
    }

    container.addTextDisplayComponents(t => t.setContent(tz('ui.pickHintFish') || 'Press a zone button to fish.'));

    container.addActionRowComponents(row => row.addComponents(
        ...buildFishPickButtons({ userId, page: p, zones: slice, disabled: disabledButtons })
    ));

    container.addActionRowComponents(row => row.addComponents(
        ...buildFishNavButtons({ userId, page: p, totalPages, disabled: disabledButtons })
    ));

    return { container, page: p, totalPages, slice };
}

function buildFishZonesMessageOptions({ lang = 'es-ES', userId, page = 0, perPage } = {}) {
    const { container } = buildFishZonesContainer({ lang, userId, page, perPage });
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function parseFishCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('fish:')) return null;
    const parts = raw.split(':');
    const action = parts[1] || null;
    const userId = parts[2] || null;

    if (!action || !userId) return null;

    // Formato legacy (panel de zonas): fish:action:userId:page(:index)
    const isLegacy = ['prev', 'next', 'refresh', 'close', 'help', 'pick'].includes(action);
    if (isLegacy) {
        const page = parts[3] || '0';
        const index = parts[4];
        return {
            action,
            userId,
            page: Number.parseInt(page, 10) || 0,
            index: index !== undefined ? Number.parseInt(index, 10) : null,
            parts,
        };
    }

    // Otros formatos (minijuegos): deja que el handler interprete parts
    return { action, userId, page: 0, index: null, parts };
}

module.exports = {
    FISH_ZONES,
    resolveFishZone,
    hasInventoryItem,
    buildFishZonesContainer,
    buildFishZonesMessageOptions,
    parseFishCustomId,
    getZoneForPick,
};
