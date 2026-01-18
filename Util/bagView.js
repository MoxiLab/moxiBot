const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { loadCatalog, buildItemIndex, resolveLocalizedString, resolveCategoryFromLanguages, normalizeItemForLang } = require('./inventoryCatalog');

let _catalogCache = null;
let _byIdCache = null;
let _categoryByItemIdCache = null;

let _shopByItemIdCache = null;

function getCatalogIndexes() {
  if (_byIdCache && _categoryByItemIdCache) return { byId: _byIdCache, categoryByItemId: _categoryByItemIdCache };
  _catalogCache = loadCatalog();
  const { byId } = buildItemIndex(_catalogCache);
  _byIdCache = byId;

  const categoryByItemId = new Map();
  for (const cat of _catalogCache) {
    const categoryLabel = cat?.category || 'Otros';
    const items = Array.isArray(cat?.items) ? cat.items : [];
    for (const item of items) {
      if (!item?.id) continue;
      categoryByItemId.set(item.id, categoryLabel);
    }
  }
  _categoryByItemIdCache = categoryByItemId;

  return { byId: _byIdCache, categoryByItemId: _categoryByItemIdCache };
}

function getShopIndexes() {
  if (_shopByItemIdCache) return { shopByItemId: _shopByItemIdCache };
  // Lazy require para evitar ciclos
  // eslint-disable-next-line global-require
  const { buildShopData } = require('./shopView');
  const { byItemId } = buildShopData();
  _shopByItemIdCache = byItemId;
  return { shopByItemId: _shopByItemIdCache };
}

function safeInt(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function paginate(items, page, pageSize) {
  const size = Math.max(1, safeInt(pageSize, 10));
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(Math.max(0, safeInt(page, 0)), totalPages - 1);
  const start = safePage * size;
  return { slice: items.slice(start, start + size), page: safePage, totalPages, size };
}

function slugifyKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'otros';
}

async function getIventoryRows(userId, { lang = process.env.DEFAULT_LANG || 'es-ES' } = {}) {
  const { Economy } = require('../Models/EconomySchema');
  const { getOrCreateEconomy } = require('./economyCore');

  let eco = null;
  try {
    eco = await getOrCreateEconomy(userId);
  } catch {
    // Sin DB o error de conexión: devolvemos vacío de forma segura
    return { items: [], balance: 0 };
  }

  // Seguridad adicional: si algo raro devolvió null
  if (!eco) {
    return { items: [], balance: 0 };
  }

  const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
  const totals = new Map();
  for (const row of inv) {
    if (!row || !row.itemId) continue;
    const amount = Math.max(0, safeInt(row.amount, 0));
    if (!amount) continue;
    totals.set(row.itemId, (totals.get(row.itemId) || 0) + amount);
  }

  const { byId, categoryByItemId } = getCatalogIndexes();
  const { shopByItemId } = getShopIndexes();

  const items = Array.from(totals.entries())
    .map(([itemId, amount]) => {
      const rawItem = byId.get(itemId) || null;
      const item = rawItem ? normalizeItemForLang(rawItem, lang) : null;
      const shop = shopByItemId.get(itemId) || null;
      const rawCategory = categoryByItemId.get(itemId) || 'Otros';
      return {
        itemId,
        amount,
        shopId: safeInt(shop?.shopId, 0),
        name: resolveLocalizedString(item?.name, lang) || itemId,
        description: resolveLocalizedString(item?.description, lang) || '',
        rarity: item?.rarity || 'comun',
        category: resolveCategoryFromLanguages(rawCategory, lang) || resolveLocalizedString(rawCategory, lang) || String(rawCategory || 'Otros'),
      };
    })
    .sort((a, b) => {
      const sa = safeInt(a.shopId, 0);
      const sb = safeInt(b.shopId, 0);
      if (sa && sb) return sa - sb;
      if (sa && !sb) return -1;
      if (!sa && sb) return 1;
      return a.name.localeCompare(b.name, lang || 'es', { sensitivity: 'base' });
    });

  return { items, balance: safeInt(eco.balance, 0) };
}

function buildBagEmbed({ title, categoryLabel, itemsTotal, pageItems, page, totalPages, helpLines = [] }) {
  const lines = pageItems.map((it) => {
    const idPart = safeInt(it.shopId, 0) ? `\`${safeInt(it.shopId, 0)}\` ` : '';
    return `${idPart}${it.name} (x${safeInt(it.amount, 0)})`;
  });

  const desc = [
    ...helpLines,
    lines.length ? lines.join('\n') : '_No tienes items en esta categoría._',
  ].join('\n');

  return new EmbedBuilder()
    .setColor(Bot.AccentColor)
    .setTitle(title)
    .setDescription(desc)
    .setFooter({ text: `Página ${page + 1} de ${totalPages}` });
}

async function buildBagMessage({ userId, viewerId, page = 0, selectedCategoryKey = null, isPrivate = false, pageSize = 10, lang = process.env.DEFAULT_LANG || 'es-ES' } = {}) {
  const { items } = await getIventoryRows(userId, { lang });

  const applicationId = process.env.CLIENT_ID;
  let useMention = '/use';
  let buffsMention = '/buffs';
  if (applicationId) {
    try {
      // Lazy import to avoid cycles
      // eslint-disable-next-line global-require
      const { slashMention } = require('./slashCommandMentions');
      useMention = await slashMention({ name: 'use', applicationId });
      buffsMention = await slashMention({ name: 'buffs', applicationId });
    } catch {
      // keep fallbacks
    }
  }

  const helpLines = [
    `Puedes consumir un item con: ${useMention}`,
    `Puedes mirar tus potenciadores activos con: ${buffsMention}`,
    '',
  ];

  const categoriesMap = new Map();
  for (const it of items) {
    const label = String(it.category || 'Otros');
    const key = slugifyKey(label);
    if (!categoriesMap.has(key)) {
      categoriesMap.set(key, { key, label, items: [], uniqueCount: 0, totalQty: 0 });
    }
    const cat = categoriesMap.get(key);
    cat.items.push(it);
    cat.uniqueCount += 1;
    cat.totalQty += Math.max(0, safeInt(it.amount, 0));
  }

  const categories = Array.from(categoriesMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label, lang || 'es', { sensitivity: 'base' })
  );

  const activeCategoryKey =
    selectedCategoryKey && categoriesMap.has(selectedCategoryKey)
      ? selectedCategoryKey
      : (categories[0]?.key || null);

  const activeCategory = activeCategoryKey ? categoriesMap.get(activeCategoryKey) : null;
  const activeItems = Array.isArray(activeCategory?.items) ? activeCategory.items : [];

  const { slice, page: safePage, totalPages } = paginate(activeItems, page, pageSize);

  const title = isPrivate ? '🎒 Tu mochila (privada)' : '🎒 Tu mochila';

  const embed = buildBagEmbed({
    title,
    categoryLabel: activeCategory?.label || 'Otros',
    itemsTotal: activeItems.length,
    pageItems: slice,
    page: safePage,
    totalPages,
    helpLines,
  });

  const prevDisabled = safePage <= 0;
  const nextDisabled = safePage >= totalPages - 1;

  const select = new StringSelectMenuBuilder()
    .setCustomId(`bag:sel:${viewerId}:${safePage}`)
    .setPlaceholder(activeCategory?.label || 'Elige una categoría')
    .addOptions(
      categories.length
        ? categories.slice(0, 25).map((c) => ({
          label: c.label.length > 90 ? c.label.slice(0, 90) : c.label,
          value: c.key,
          description: `${safeInt(c.uniqueCount, 0)} tipos • ${safeInt(c.totalQty, 0)} total`.slice(0, 100),
          default: activeCategoryKey ? c.key === activeCategoryKey : false,
        }))
        : [{ label: 'No tienes items', value: 'none', default: true }]
    );

  const selectRow = new ActionRowBuilder().addComponents(select);

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bag:nav:${viewerId}:${activeCategoryKey || 'none'}:${safePage}:prev`)
      .setEmoji(EMOJIS.arrowLeft)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(prevDisabled),
    new ButtonBuilder()
      .setCustomId(`bag:nav:${viewerId}:${activeCategoryKey || 'none'}:${safePage}:home`)
      .setEmoji(EMOJIS.package)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bag:nav:${viewerId}:${activeCategoryKey || 'none'}:${safePage}:close`)
      .setEmoji(EMOJIS.cross)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`bag:nav:${viewerId}:${activeCategoryKey || 'none'}:${safePage}:info`)
      .setEmoji(EMOJIS.question)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bag:nav:${viewerId}:${activeCategoryKey || 'none'}:${safePage}:next`)
      .setEmoji(EMOJIS.arrowRight)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(nextDisabled)
  );

  return {
    embeds: [embed],
    components: [selectRow, buttonRow],
    __meta: { categoryKey: activeCategoryKey, page: safePage, totalPages },
  };
}

module.exports = {
  buildBagMessage,
};
