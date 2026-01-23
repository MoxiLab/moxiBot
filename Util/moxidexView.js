const {
    ActionRowBuilder,
    DangerButtonBuilder,
    EmbedBuilder,
    SecondaryButtonBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { Bot } = require('../Config');
const { EMOJIS, toEmojiObject } = require('./emojis');
const { getItemById } = require('./inventoryCatalog');
const { formatRemaining } = require('./petSystem');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

const ALL_TIER_KEYS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine'];

function normalizeTierKey(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw || raw === 'all' || raw === 'todos') return 'all';
    if (raw === 'legendario') return 'legendary';
    if (raw === 'epico' || raw === 'épico') return 'epic';
    if (raw === 'raro') return 'rare';
    if (raw === 'mitico' || raw === 'mítico') return 'mythic';
    if (raw === 'divino') return 'divine';
    if (raw === 'poco-comun' || raw === 'poco común' || raw === 'uncommon') return 'uncommon';
    if (raw === 'comun' || raw === 'común') return 'common';
    if (ALL_TIER_KEYS.includes(raw)) return raw;
    return raw;
}

function tierLabel(key) {
    switch (normalizeTierKey(key)) {
        case 'divine':
            return 'Divino';
        case 'mythic':
            return 'Mítico';
        case 'legendary':
            return 'Legendario';
        case 'epic':
            return 'Épico';
        case 'rare':
            return 'Raro';
        case 'uncommon':
            return 'Poco común';
        case 'common':
            return 'Común';
        case 'all':
        default:
            return 'Todos los tiers';
    }
}

function sortLabel(sortKey) {
    switch (String(sortKey || 'new')) {
        case 'name':
            return 'Nombre';
        case 'level':
            return 'Nivel';
        case 'tier':
            return 'Tier';
        case 'new':
        default:
            return 'Recientes';
    }
}

function cycleSort(sortKey) {
    const s = String(sortKey || 'new');
    if (s === 'new') return 'name';
    if (s === 'name') return 'level';
    if (s === 'level') return 'tier';
    return 'new';
}

function paginate(items, page, pageSize) {
    const size = Math.max(1, safeInt(pageSize, 8));
    const totalPages = Math.max(1, Math.ceil(items.length / size));
    const safePage = Math.min(Math.max(0, safeInt(page, 0)), totalPages - 1);
    const start = safePage * size;
    return { slice: items.slice(start, start + size), page: safePage, totalPages, size };
}

async function getUserPets(userId) {
    const { Economy } = require('../Models/EconomySchema');

    if (typeof process.env.MONGODB === 'string' && process.env.MONGODB.trim()) {
        const { ensureMongoConnection } = require('./mongoConnect');
        await ensureMongoConnection();
    }

    let eco = await Economy.findOne({ userId });
    if (!eco) eco = await Economy.create({ userId, balance: 0, bank: 0, sakuras: 0 });

    const pets = Array.isArray(eco.pets) ? eco.pets : [];
    const incubation = eco.petIncubation || null;

    return { pets, incubation };
}

function buildTierOptions(pets, selectedTier) {
    const options = [
        { label: 'Todos los tiers', value: 'all', default: normalizeTierKey(selectedTier) === 'all' },
        ...ALL_TIER_KEYS.map((k) => ({
            label: tierLabel(k),
            value: k,
            default: normalizeTierKey(selectedTier) === k,
        })),
    ];

    return options.length ? options : [{ label: 'Todos los tiers', value: 'all', default: true }];
}

function compareByTier(a, b) {
    const order = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, divine: 7 };
    const ta = normalizeTierKey(a?.attributes?.rarity || 'common');
    const tb = normalizeTierKey(b?.attributes?.rarity || 'common');
    return (order[ta] || 99) - (order[tb] || 99);
}

function formatPetLine(pet, idx, lang) {
    const name = String(pet?.name || 'Sin nombre');
    const level = safeInt(pet?.level, 1) || 1;
    const tier = tierLabel(pet?.attributes?.rarity || 'common');
    const id = pet?.petId ? String(pet.petId) : '—';
    return `**${idx}. ${name}**  (Nv. ${level}) — ${tier}\nID: \`${id}\``;
}

async function buildMoxidexMessage({
    userId,
    viewerId,
    tierKey = 'all',
    sort = 'new',
    page = 0,
    pageSize = 8,
    lang = process.env.DEFAULT_LANG || 'es-ES',
} = {}) {
    const { pets, incubation } = await getUserPets(userId);

    const activePet = pets.length ? pets[pets.length - 1] : null;
    const activeText = activePet
        ? `**${activePet.name || 'Sin nombre'}** (Nv. ${safeInt(activePet.level, 1) || 1}) — ${tierLabel(activePet?.attributes?.rarity || 'common')}`
        : '_Ninguna_';

    let incLine = null;
    if (incubation?.eggItemId && incubation?.hatchAt) {
        const egg = getItemById(incubation.eggItemId, { lang });
        const eggName = egg?.name || incubation.eggItemId;
        const rem = formatRemaining(incubation, Date.now());
        incLine = `Incubación: **${eggName}** — ${rem ? `**${rem}**` : '...'} restante`;
    }

    const safeTier = normalizeTierKey(tierKey);
    let filtered = pets;
    if (safeTier !== 'all') {
        filtered = pets.filter((p) => normalizeTierKey(p?.attributes?.rarity || 'common') === safeTier);
    }

    const safeSort = String(sort || 'new');
    const sorted = [...filtered];
    if (safeSort === 'name') {
        sorted.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), lang || 'es', { sensitivity: 'base' }));
    } else if (safeSort === 'level') {
        sorted.sort((a, b) => safeInt(b?.level, 1) - safeInt(a?.level, 1));
    } else if (safeSort === 'tier') {
        sorted.sort((a, b) => {
            const t = compareByTier(b, a);
            if (t !== 0) return t;
            return String(a?.name || '').localeCompare(String(b?.name || ''), lang || 'es', { sensitivity: 'base' });
        });
    } else {
        // new: el array ya suele estar en orden de inserción; mostramos recientes primero
        sorted.reverse();
    }

    const { slice, page: safePage, totalPages } = paginate(sorted, page, pageSize);

    const lines = slice.map((p, i) => formatPetLine(p, safePage * pageSize + i + 1, lang));

    const headerLines = [
        `Activa: ${activeText}`,
        `Mascotas: **${pets.length}**`,
        `Filtro: **${tierLabel(safeTier)}**`,
        `Orden: **${sortLabel(safeSort)}**`,
    ];
    if (incLine) headerLines.push(incLine);

    const embed = new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle('🐾 Moxidex')
        .setDescription([
            ...headerLines,
            '',
            lines.length ? lines.join('\n\n') : '_No tienes mascotas en este filtro._',
        ].join('\n'))
        .setFooter({ text: `Página ${safePage + 1} de ${totalPages}` });

    const prevDisabled = safePage <= 0;
    const nextDisabled = safePage >= totalPages - 1;

    const select = new StringSelectMenuBuilder()
        .setCustomId(`moxidex:tier:${viewerId}:${safeSort}:${safePage}`)
        .setPlaceholder(tierLabel(safeTier))
        .addOptions(buildTierOptions(pets, safeTier).slice(0, 25));

    const selectRow = new ActionRowBuilder().addComponents(select);

    const buttonRow = new ActionRowBuilder().addComponents(
        new SecondaryButtonBuilder()
            .setCustomId(`moxidex:nav:${viewerId}:${safeTier}:${safeSort}:${safePage}:prev`)
            .setEmoji(toEmojiObject(EMOJIS.arrowLeft))
            .setDisabled(prevDisabled),
        new SecondaryButtonBuilder()
            .setCustomId(`moxidex:home:${viewerId}`)
            .setEmoji(toEmojiObject(EMOJIS.home)),
        new SecondaryButtonBuilder()
            .setCustomId(`moxidex:sort:${viewerId}:${safeTier}:${safeSort}:${safePage}`)
            .setEmoji(toEmojiObject('🔀')),
        new SecondaryButtonBuilder()
            .setCustomId(`moxidex:info:${viewerId}`)
            .setEmoji(toEmojiObject(EMOJIS.info)),
        new SecondaryButtonBuilder()
            .setCustomId(`moxidex:nav:${viewerId}:${safeTier}:${safeSort}:${safePage}:next`)
            .setEmoji(toEmojiObject(EMOJIS.arrowRight))
            .setDisabled(nextDisabled),
    );

    const closeRow = new ActionRowBuilder().addComponents(
        new DangerButtonBuilder()
            .setCustomId(`moxidex:close:${viewerId}`)
            .setEmoji(toEmojiObject(EMOJIS.cross))
    );

    return {
        embeds: [embed],
        components: [selectRow, buttonRow, closeRow],
        __meta: { tierKey: safeTier, sort: safeSort, page: safePage, totalPages },
    };
}

module.exports = {
    buildMoxidexMessage,
    normalizeTierKey,
    cycleSort,
};
