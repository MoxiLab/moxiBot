const {
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');

const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { getItemById } = require('./inventoryCatalog');
const { FISH_ZONES } = require('./fishView');

const COIN = EMOJIS.coin || '\u{1FA99}'; // 🪙
const YEAR = new Date().getFullYear();
const BRAND_FOOTER = `© MoxiBot • ${YEAR}`;

const MINE_ZONES = Object.freeze([
    {
        id: 'cantera-prisma',
        name: 'Cantera Prisma',
        emoji: '⛏️',
        requiredItemId: 'herramientas/pico-prisma',
        reward: { min: 60, max: 140 },
        aliases: ['cantera'],
    },
    {
        id: 'minas-oxidadas',
        name: 'Minas Oxidadas',
        emoji: '⚙️',
        requiredItemId: 'herramientas/pico-prisma',
        reward: { min: 80, max: 180 },
        aliases: ['oxidadas'],
    },
    {
        id: 'vetas-lunares',
        name: 'Vetas Lunares',
        emoji: '🌙',
        requiredItemId: 'herramientas/pico-prisma',
        reward: { min: 110, max: 240 },
        aliases: ['lunares', 'vetas'],
    },
    {
        id: 'galeria-fracturada',
        name: 'Galería Fracturada',
        emoji: '🪨',
        requiredItemId: 'herramientas/dinamita',
        reward: { min: 140, max: 320 },
        aliases: ['fracturada', 'galeria'],
    },
    {
        id: 'tajo-prohibido',
        name: 'Tajo Prohibido',
        emoji: '🚧',
        requiredItemId: 'herramientas/dinamita',
        reward: { min: 170, max: 390 },
        aliases: ['prohibido', 'tajo'],
    },
    {
        id: 'extraccion-automatizada',
        name: 'Extracción Automatizada',
        emoji: '🤖',
        requiredItemId: 'herramientas/golem-minero-pescador',
        reward: { min: 130, max: 300 },
        aliases: ['automatizada', 'golem'],
    },
]);

const EXPLORE_ZONES = Object.freeze([
    {
        id: 'sendero-antiguo',
        name: 'Sendero Antiguo',
        emoji: '🧭',
        requiredItemId: 'herramientas/llave-multiusos',
        reward: { min: 55, max: 130 },
        aliases: ['sendero'],
    },
    {
        id: 'bosque-elemental',
        name: 'Bosque Elemental',
        emoji: '🌿',
        requiredItemId: 'herramientas/hacha-elemental',
        reward: { min: 70, max: 160 },
        aliases: ['bosque'],
    },
    {
        id: 'ruinas-ocultas',
        name: 'Ruinas Ocultas',
        emoji: '🏛️',
        requiredItemId: 'herramientas/revelador-prisma',
        reward: { min: 120, max: 280 },
        aliases: ['ocultas'],
    },
    {
        id: 'faros-solares',
        name: 'Faros Solares',
        emoji: '🔆',
        requiredItemId: 'herramientas/varita-solar',
        reward: { min: 95, max: 220 },
        aliases: ['faros'],
    },
    {
        id: 'costa-perdida',
        name: 'Costa Perdida',
        emoji: '🏝️',
        requiredItemId: 'herramientas/barco-moxi',
        reward: { min: 140, max: 330 },
        aliases: ['costa'],
    },
    {
        id: 'tunnel-sombras',
        name: 'Túnel de Sombras',
        emoji: '🕯️',
        requiredItemId: 'buffs/linterna-solar',
        reward: { min: 160, max: 360 },
        aliases: ['sombras', 'tunel'],
    },
]);

const ZONE_KINDS = Object.freeze({
    fish: { id: 'fish', label: 'Pesca', emoji: '🎣' },
    mine: { id: 'mine', label: 'Minería', emoji: '⛏️' },
    explore: { id: 'explore', label: 'Exploración', emoji: '🧭' },
});

function safeInt(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.trunc(x);
}

function clampInt(n, min, max) {
    const x = Number.parseInt(String(n), 10);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
}

function itemLabel(itemId) {
    const item = getItemById(itemId);
    return item?.name ? `**${item.name}**` : `**${itemId}**`;
}

function normalizeKind(kind) {
    const k = String(kind || '').trim().toLowerCase();
    if (k === 'pesca' || k === 'fish') return 'fish';
    if (k === 'mineria' || k === 'mining' || k === 'mine') return 'mine';
    if (k === 'exploracion' || k === 'explore') return 'explore';
    return 'fish';
}

function getZonesForKind(kind) {
    const k = normalizeKind(kind);
    if (k === 'fish') return FISH_ZONES;
    if (k === 'mine') return MINE_ZONES;
    if (k === 'explore') return EXPLORE_ZONES;
    return FISH_ZONES;
}

function getZonesPage({ kind, page = 0, perPage = 5 } = {}) {
    const zones = getZonesForKind(kind);
    const safePerPage = Math.max(1, Math.min(5, safeInt(perPage, 5)));
    const totalPages = Math.max(1, Math.ceil(zones.length / safePerPage));
    const p = clampInt(page, 0, totalPages - 1);
    const start = p * safePerPage;
    const slice = zones.slice(start, start + safePerPage);
    return { zones, page: p, perPage: safePerPage, totalPages, slice };
}

function buildKindSelect({ userId, kind, page = 0, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const current = normalizeKind(kind);
    const p = clampInt(page, 0, 999);

    return new StringSelectMenuBuilder()
        .setCustomId(`zones:select:${safeUserId}:${current}:${p}`)
        .setPlaceholder('Selecciona una categoría…')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(disabled)
        .addOptions(
            {
                label: 'Pesca',
                value: 'fish',
                emoji: ZONE_KINDS.fish.emoji,
                default: current === 'fish',
            },
            {
                label: 'Minería',
                value: 'mine',
                emoji: ZONE_KINDS.mine.emoji,
                default: current === 'mine',
            },
            {
                label: 'Exploración',
                value: 'explore',
                emoji: ZONE_KINDS.explore.emoji,
                default: current === 'explore',
            }
        );
}

function buildNavButtons({ userId, kind, page, totalPages, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const k = normalizeKind(kind);
    const p = clampInt(page, 0, Math.max(0, (totalPages || 1) - 1));

    const prev = new ButtonBuilder()
        .setCustomId(`zones:prev:${safeUserId}:${k}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.arrowLeft)
        .setDisabled(disabled || p <= 0);

    const refresh = new ButtonBuilder()
        .setCustomId(`zones:refresh:${safeUserId}:${k}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔁')
        .setDisabled(disabled);

    const close = new ButtonBuilder()
        .setCustomId(`zones:close:${safeUserId}:${k}:${p}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(EMOJIS.cross)
        .setDisabled(disabled);

    const help = new ButtonBuilder()
        .setCustomId(`zones:help:${safeUserId}:${k}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.question)
        .setDisabled(disabled);

    const next = new ButtonBuilder()
        .setCustomId(`zones:next:${safeUserId}:${k}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.arrowRight)
        .setDisabled(disabled || p >= (totalPages - 1));

    return [prev, refresh, close, help, next];
}

function buildPickButtons({ userId, kind, page, slice, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const k = normalizeKind(kind);
    const p = clampInt(page, 0, 999);
    const zones = Array.isArray(slice) ? slice : [];

    return zones.map((z, index) =>
        new ButtonBuilder()
            .setCustomId(`zones:pick:${safeUserId}:${k}:${p}:${index}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(z?.emoji || '📍')
            .setLabel(String(z?.id || `zona-${index + 1}`))
            .setDisabled(disabled)
    );
}

function buildZonesContainer({ lang = 'es-ES', userId, kind = 'fish', page = 0, perPage = 5, disabledButtons = false } = {}) {
    const k = normalizeKind(kind);
    const kindInfo = ZONE_KINDS[k] || ZONE_KINDS.fish;

    const { page: p, totalPages, slice, zones } = getZonesPage({ kind: k, page, perPage });

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(t => t.setContent(`Página ${p + 1} de ${totalPages}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => {
            if (k === 'fish') return t.setContent('## Fish • Zonas');
            return t.setContent(`## ${kindInfo.emoji} Zonas • ${kindInfo.label}`);
        });

    if (k === 'fish') {
        container
            .addTextDisplayComponents(t => t.setContent(`Zonas de pesca disponibles: **${zones.length}**`))
            .addSeparatorComponents(s => s.setDivider(true));
    }

    if (!zones.length) {
        container.addTextDisplayComponents(t => t.setContent('Próximamente…\nPor ahora solo está disponible **Pesca**.'));
    } else {
        for (const z of slice) {
            const rewardText = k === 'fish'
                ? `Requiere: ${itemLabel(z.requiredItemId)}`
                : `Requiere: ${itemLabel(z.requiredItemId)} | Recompensa: **${z.reward?.min ?? 0}-${z.reward?.max ?? 0}** ${COIN}`;
            container
                .addTextDisplayComponents(t =>
                    t.setContent(
                        `${z.emoji || '📍'} **${z.id}** — ${z.name}\n` +
                        rewardText
                    )
                )
                .addSeparatorComponents(s => s.setDivider(true));
        }

        container.addTextDisplayComponents(t => {
            if (k === 'fish') return t.setContent('Pulsa un botón de zona para pescar.');
            return t.setContent('Pulsa una zona para hacer la acción.');
        });
    }

    // Row 1: botones de acción por zona (solo si hay zonas)
    if (zones.length) {
        container.addActionRowComponents(row => row.addComponents(
            ...buildPickButtons({ userId, kind: k, page: p, slice, disabled: disabledButtons })
        ));
    }

    // Row 2: navegación
    container.addActionRowComponents(row => row.addComponents(
        ...buildNavButtons({ userId, kind: k, page: p, totalPages, disabled: disabledButtons })
    ));

    // Row 3: select debajo de los botones
    container.addActionRowComponents(row => row.addComponents(
        buildKindSelect({ userId, kind: k, page: p, disabled: disabledButtons })
    ));

    // Footer (paginación) debajo del select
    container
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(`${BRAND_FOOTER}`));

    return { container, kind: k, page: p, totalPages, slice };
}

function buildZonesMessageOptions({ lang = 'es-ES', userId, kind = 'fish', page = 0, perPage } = {}) {
    const { container } = buildZonesContainer({ lang, userId, kind, page, perPage });
    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function parseZonesCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('zones:')) return null;

    const parts = raw.split(':');
    // zones:action:userId:kind:page(:index)
    const action = parts[1] || null;
    const userId = parts[2] || null;
    const kind = parts[3] || null;
    const page = parts[4] || '0';
    const index = parts[5];

    if (!action || !userId || !kind) return null;

    return {
        action,
        userId,
        kind: normalizeKind(kind),
        page: Number.parseInt(page, 10) || 0,
        index: index !== undefined ? Number.parseInt(index, 10) : null,
    };
}

function getZoneForPick({ kind, page, index, perPage = 5 } = {}) {
    const { zones, page: p } = getZonesPage({ kind, page, perPage });
    const start = p * Math.max(1, Math.min(5, safeInt(perPage, 5)));
    const i = clampInt(index, 0, 4);
    return zones[start + i] || null;
}

module.exports = {
    ZONE_KINDS,
    normalizeKind,
    buildZonesContainer,
    buildZonesMessageOptions,
    parseZonesCustomId,
    getZoneForPick,
};
