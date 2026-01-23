const { ActionRowBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');
const { Bot } = require('../Config');
const moxi = require('../i18n');
const { loadCatalog, resolveLocalizedString, resolveCategoryFromLanguages, normalizeItemForLang } = require('./inventoryCatalog');
const { EMOJIS } = require('./emojis');
const { BANK_UPGRADE_ITEM_ID, getBankUpgradeCost } = require('./bankSystem');

function slugify(input) {
    return String(input || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function buildShopData({ catalogPath, lang = process.env.DEFAULT_LANG || 'es-ES' } = {}) {
    const catalog = loadCatalog({ lang });

    const categories = catalog
        .filter((c) => c && c.category)
        .map((c) => ({
            // categoryKey es la clave estable (p.ej. "Buffs"). category puede estar traducido.
            categoryKey: String(c.categoryKey || c.category || ''),
            label:
                resolveCategoryFromLanguages(c.categoryKey || c.category, lang) ||
                String(c.label || c.category),
            key: slugify(String(c.categoryKey || c.category)) || 'categoria',
            items: Array.isArray(c.items) ? c.items : [],
        }));

    const allItems = [];
    let index = 1;
    for (const cat of categories) {
        for (const item of cat.items) {
            if (!item || !item.id) continue;
            const normalized = normalizeItemForLang(item, lang);
            const computedPrice = Number.isFinite(item.price) ? item.price : 0;
            const price = item.id === BANK_UPGRADE_ITEM_ID ? getBankUpgradeCost(0) : computedPrice;
            allItems.push({
                shopId: index++,
                itemId: item.id,
                name: resolveLocalizedString(normalized?.name, lang) || item.id,
                description: resolveLocalizedString(normalized?.description, lang) || '',
                price,
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
    const t = (k, vars = {}) => moxi.translate(`economy/shop:${k}`, lang, vars);

    const { categories, allItems, categoryKeyToLabel } = buildShopData({ catalogPath, lang });

    const filtered = categoryKey === 'all'
        ? allItems
        : allItems.filter((i) => i.categoryKey === categoryKey);

    const { slice, page: safePage, totalPages } = paginate(filtered, page, pageSize);

    const categoryLabel = categoryKey === 'all'
        ? t('SHOP_ALL_ITEMS')
        : (categoryKeyToLabel.get(categoryKey) || t('SHOP_CATEGORY'));

    const lines = slice.map((i) => {
        const price = Number.isFinite(i.price) ? i.price : 0;
        const header = `**${i.name}**  ID: **${i.shopId}** — **${price}** 🪙`;
        const desc = i.description ? `\n${i.description}` : '';
        return `${header}${desc}`;
    });

    const embed = new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle(t('SHOP_EMBED_TITLE'))
        .setDescription(
            [
                t('SHOP_WELCOME'),
                t('SHOP_INSTRUCTIONS', { prefix: process.env.PREFIX || '.' }),
                '',
                t('SHOP_LIST_TITLE'),
                '',
                lines.length ? lines.join('\n\n') : t('SHOP_NO_ITEMS'),
            ].join('\n')
        )
        .setFooter({ text: t('SHOP_FOOTER_PAGE', { page: safePage + 1, total: totalPages }) });

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
        .setPlaceholder(t('SHOP_ALL_ITEMS'))
        .addOptions([
            { label: t('SHOP_ALL_ITEMS'), value: 'all', default: categoryKey === 'all' },
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
