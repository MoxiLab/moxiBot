const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { Bot } = require('../Config');
const { loadCatalog, resolveLocalizedString, resolveCategoryFromLanguages, normalizeItemForLang } = require('./inventoryCatalog');
const { EMOJIS } = require('./emojis');

function slugify(input) {
    return String(input || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function buildShopData({ catalogPath, lang = process.env.DEFAULT_LANG || 'es-ES' } = {}) {
    const catalog = loadCatalog(catalogPath);

    const categories = catalog
        .filter((c) => c && c.category)
        .map((c) => ({
            label: resolveCategoryFromLanguages(c.category, lang) || resolveLocalizedString(c.category, lang) || String(c.category),
            key: slugify(resolveCategoryFromLanguages(c.category, lang) || resolveLocalizedString(c.category, lang) || String(c.category)) || 'categoria',
            items: Array.isArray(c.items) ? c.items : [],
        }));

    const allItems = [];
    let index = 1;
    for (const cat of categories) {
        for (const item of cat.items) {
            if (!item || !item.id) continue;
            const normalized = normalizeItemForLang(item, lang);
            allItems.push({
                shopId: index++,
                itemId: item.id,
                name: resolveLocalizedString(normalized?.name, lang) || item.id,
                description: resolveLocalizedString(normalized?.description, lang) || '',
                price: Number.isFinite(item.price) ? item.price : 0,
                rarity: item.rarity || 'common',
                categoryLabel: cat.label,
                categoryKey: cat.key,
            });
        }
    }

    const byShopId = new Map(allItems.map((i) => [i.shopId, i]));
    const byItemId = new Map(allItems.map((i) => [i.itemId, i]));
    const categoryKeyToLabel = new Map(categories.map((c) => [c.key, c.label]));

    return { categories, allItems, byShopId, byItemId, categoryKeyToLabel };
}

function paginate(items, page, pageSize) {
    const safeSize = Math.max(1, pageSize || 5);
    const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
    const safePage = Math.min(Math.max(0, page || 0), totalPages - 1);
    const start = safePage * safeSize;
    const slice = items.slice(start, start + safeSize);
    return { slice, page: safePage, totalPages };
}

function buildShopMessage({
    userId,
    categoryKey = 'all',
    page = 0,
    catalogPath,
    pageSize = 5,
    lang = process.env.DEFAULT_LANG || 'es-ES',
} = {}) {
    const { categories, allItems, categoryKeyToLabel } = buildShopData({ catalogPath, lang });

    const filtered = categoryKey === 'all'
        ? allItems
        : allItems.filter((i) => i.categoryKey === categoryKey);

    const { slice, page: safePage, totalPages } = paginate(filtered, page, pageSize);

    const categoryLabel = categoryKey === 'all'
        ? 'Todos los ítems'
        : (categoryKeyToLabel.get(categoryKey) || 'Categoría');

    const lines = slice.map((i) => {
        const price = Number.isFinite(i.price) ? i.price : 0;
        const header = `**${i.name}**  ID: **${i.shopId}** — **${price}** 🪙`;
        const desc = i.description ? `\n${i.description}` : '';
        return `${header}${desc}`;
    });

    const embed = new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle('�️ Tienda de Moxi')
        .setDescription(
            [
                'Bienvenido/a a mi tiendita.',
                'Puedes comprar con: `/moxishop buy` o `.moxishop buy`',
                '',
                `**Lista de ítems**`,
                '',
                lines.length ? lines.join('\n\n') : '_No hay ítems en esta categoría._',
            ].join('\n')
        )
        .setFooter({ text: `Página ${safePage + 1} de ${totalPages}` });

    const prevDisabled = safePage <= 0;
    const nextDisabled = safePage >= totalPages - 1;

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`shop:nav:${userId}:${categoryKey}:${safePage}:prev`)
            .setEmoji(EMOJIS.arrowLeft)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(prevDisabled),
        new ButtonBuilder()
            .setCustomId(`shop:home:${userId}:${categoryKey}`)
            .setEmoji(EMOJIS.home)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`shop:info:${userId}:${categoryKey}:${totalPages}`)
            .setEmoji(EMOJIS.info)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`shop:close:${userId}`)
            .setEmoji(EMOJIS.stopSign)
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`shop:nav:${userId}:${categoryKey}:${safePage}:next`)
            .setEmoji(EMOJIS.arrowRight)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(nextDisabled)
    );

    const select = new StringSelectMenuBuilder()
        .setCustomId(`shop:cat:${userId}:${safePage}`)
        .setPlaceholder('Todos los ítems')
        .addOptions([
            { label: 'Todos los ítems', value: 'all', default: categoryKey === 'all' },
            ...categories.map((c) => ({
                label: c.label,
                value: c.key,
                default: categoryKey === c.key,
            })),
        ]);

    const selectRow = new ActionRowBuilder().addComponents(select);

    return {
        embeds: [embed],
        components: [selectRow, buttonRow],
        __meta: { categoryKey, page: safePage, totalPages },
    };
}

module.exports = {
    slugify,
    buildShopData,
    buildShopMessage,
};
