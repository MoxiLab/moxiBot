const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { loadCatalog, buildItemIndex } = require('./inventoryCatalog');

let _catalogCache = null;
let _byIdCache = null;
let _categoryByItemIdCache = null;

function getCatalogIndexes() {
  if (_byIdCache && _categoryByItemIdCache) return { byId: _byIdCache, categoryByItemId: _categoryByItemIdCache };
  _catalogCache = loadCatalog();
  const { byId } = buildItemIndex(_catalogCache);
  _byIdCache = byId;

  const categoryByItemId = new Map();
  for (const cat of _catalogCache) {
    const categoryLabel = String(cat?.category || 'Otros');
    const items = Array.isArray(cat?.items) ? cat.items : [];
    for (const item of items) {
      if (!item?.id) continue;
      categoryByItemId.set(item.id, categoryLabel);
    }
  }
  _categoryByItemIdCache = categoryByItemId;

  return { byId: _byIdCache, categoryByItemId: _categoryByItemIdCache };
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

async function getUserInventoryRows(userId) {
  const { UserEconomy } = require('../Models/EconomySchema');

  if (typeof process.env.MONGODB === 'string' && process.env.MONGODB.trim()) {
    const { ensureMongoConnection } = require('./mongoConnect');
    await ensureMongoConnection();
  }

  let eco = await UserEconomy.findOne({ userId });
  if (!eco) eco = await UserEconomy.create({ userId, balance: 0, inventory: [] });

  const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
  const totals = new Map();
  for (const row of inv) {
    if (!row || !row.itemId) continue;
    const amount = Math.max(0, safeInt(row.amount, 0));
    if (!amount) continue;
    totals.set(row.itemId, (totals.get(row.itemId) || 0) + amount);
  }

  const { byId, categoryByItemId } = getCatalogIndexes();

  const items = Array.from(totals.entries())
    .map(([itemId, amount]) => {
      const item = byId.get(itemId) || null;
      return {
        itemId,
        amount,
        name: item?.name || itemId,
        description: item?.description || '',
        rarity: item?.rarity || 'comun',
        category: categoryByItemId.get(itemId) || 'Otros',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  return { items, balance: safeInt(eco.balance, 0) };
}

function buildBagEmbed({ title, categories, pageCategories, page, totalPages, selectedCategoryKey, balance }) {
  const totalCats = categories.length;
  const keyToIndex = new Map(categories.map((c, idx) => [c.key, idx + 1]));

  const lines = pageCategories.map((c) => {
    const idx = keyToIndex.get(c.key) || 0;
    return `**${idx}** • **${c.label}** — ${c.uniqueCount} tipos • ${c.totalQty} total`;
  });

  const selected = selectedCategoryKey
    ? categories.find((c) => c.key === selectedCategoryKey)
    : null;

  let detail = '';
  if (selected) {
    const shown = selected.items.slice(0, 10);
    const itemLines = shown.map((it) => `• **${it.name}** (x${safeInt(it.amount, 0)})`);
    const remaining = Math.max(0, selected.items.length - shown.length);
    detail = [
      `\n\n**Categoría seleccionada:** ${selected.label}`,
      itemLines.length ? itemLines.join('\n') : '_No tienes items en esta categoría._',
      remaining ? `\n_… y ${remaining} más._` : '',
    ].join('\n');
  }

  const desc = [
    `**Saldo:** ${balance} 🪙`,
    '',
    `**Categorías (${totalCats})**`,
    lines.length ? lines.join('\n') : '_No tienes items todavía._',
    detail,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(Bot.AccentColor)
    .setTitle(title)
    .setDescription(desc)
    .setFooter({ text: `Página ${page + 1} de ${totalPages}` });
}

async function buildBagMessage({ userId, viewerId, page = 0, selectedCategoryKey = null, isPrivate = false, pageSize = 10 } = {}) {
  const { items, balance } = await getUserInventoryRows(userId);

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

  const categories = Array.from(categoriesMap.values())
    .map((c) => ({
      ...c,
      items: c.items.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

  const { slice, page: safePage, totalPages } = paginate(categories, page, pageSize);

  const title = isPrivate ? '🎒 Tu mochila (privada)' : '🎒 Tu mochila';

  const selected = selectedCategoryKey && categories.some((c) => c.key === selectedCategoryKey)
    ? selectedCategoryKey
    : (slice[0]?.key || null);

  const embed = buildBagEmbed({
    title,
    categories,
    pageCategories: slice,
    page: safePage,
    totalPages,
    selectedCategoryKey: selected,
    balance,
  });

  const prevDisabled = safePage <= 0;
  const nextDisabled = safePage >= totalPages - 1;

  const select = new StringSelectMenuBuilder()
    .setCustomId(`bag:sel:${viewerId}:${safePage}`)
    .setPlaceholder('Haz una selección')
    .addOptions(
      slice.length
        ? slice.map((it) => ({
            label: it.label.length > 90 ? it.label.slice(0, 90) : it.label,
            value: it.key,
            description: `${safeInt(it.uniqueCount, 0)} tipos • ${safeInt(it.totalQty, 0)} total`.slice(0, 100),
            default: selected ? it.key === selected : false,
          }))
        : [{ label: 'No tienes items', value: 'none', default: true }]
    );

  const selectRow = new ActionRowBuilder().addComponents(select);

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bag:nav:${viewerId}:${safePage}:prev`)
      .setEmoji(EMOJIS.arrowLeft)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(prevDisabled),
    new ButtonBuilder()
      .setCustomId(`bag:nav:${viewerId}:${safePage}:home`)
      .setEmoji(EMOJIS.package)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bag:nav:${viewerId}:${safePage}:close`)
      .setEmoji(EMOJIS.cross)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`bag:nav:${viewerId}:${safePage}:info`)
      .setEmoji(EMOJIS.question)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bag:nav:${viewerId}:${safePage}:next`)
      .setEmoji(EMOJIS.arrowRight)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(nextDisabled)
  );

  return {
    embeds: [embed],
    components: [selectRow, buttonRow],
    __meta: { page: safePage, totalPages },
  };
}

module.exports = {
  buildBagMessage,
};
