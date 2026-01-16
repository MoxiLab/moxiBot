const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { getItemById } = require('./inventoryCatalog');
const { listRecipes, getRecipeDisplayName } = require('./craftSystem');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function paginate(items, page, pageSize) {
    const size = Math.max(1, safeInt(pageSize, 4));
    const totalPages = Math.max(1, Math.ceil(items.length / size));
    const safePage = Math.min(Math.max(0, safeInt(page, 0)), totalPages - 1);
    const start = safePage * size;
    return { slice: items.slice(start, start + size), page: safePage, totalPages, size };
}

function getOutputDescription(recipe) {
    const item = getItemById(recipe?.output?.itemId);
    return item?.description || '';
}

function formatMaterials(recipe) {
    const inputs = Array.isArray(recipe?.inputs) ? recipe.inputs : [];
    if (!inputs.length) return '—';
    return inputs
        .map((i) => {
            const it = getItemById(i.itemId);
            const name = it?.name || i.itemId;
            return `${name} x${safeInt(i.amount, 1)}`;
        })
        .join('  ');
}

function buildRecipeBlock(recipe, craftId) {
    const name = getRecipeDisplayName(recipe);
    const desc = getOutputDescription(recipe);
    const cost = Math.max(0, safeInt(recipe?.cost, 0));

    const header = `\u{1F6E0}\u{FE0F} **${name}**  [ID: ${craftId}]`;
    const lines = [header];
    if (desc) lines.push(desc);
    lines.push(`**Costo de creación:** ${cost || 0} \u{1FA99}`);
    lines.push(`**Materiales:** ${formatMaterials(recipe)}`);
    return lines.join('\n');
}

function buildCraftMessage({ userId, page = 0, pageSize = 4 } = {}) {
    const recipes = listRecipes();
    const indexed = recipes.map((r, idx) => ({ recipe: r, craftId: idx + 1 }));

    const { slice, page: safePage, totalPages } = paginate(indexed, page, pageSize);

    const blocks = slice.map((x) => buildRecipeBlock(x.recipe, x.craftId));

    const description = [
        'Lista de items que puedes crear.',
        'Puedes crear un item escribiendo `/craft forge` o `/craft mix`',
        '',
        blocks.length ? blocks.join('\n\n') : '_No hay recetas disponibles._',
    ].join('\n');

    const embed = new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle('\u2692\u{FE0F} Craft')
        .setDescription(description);

    const prevDisabled = safePage <= 0;
    const nextDisabled = safePage >= totalPages - 1;

    const select = new StringSelectMenuBuilder()
        .setCustomId(`craft:sel:${userId}:${safePage}`)
        .setPlaceholder('Haz una selección')
        .addOptions(
            slice.length
                ? slice.slice(0, 25).map((x) => {
                    const label = getRecipeDisplayName(x.recipe);
                    const cost = Math.max(0, safeInt(x.recipe?.cost, 0));
                    const out = getItemById(x.recipe?.output?.itemId);
                    const desc = (out?.description || `Costo: ${cost} 🪙`).slice(0, 100);
                    return {
                        label: label.length > 100 ? label.slice(0, 100) : label,
                        value: String(x.recipe.id || x.recipe.output?.itemId || x.craftId),
                        description: desc,
                    };
                })
                : [{ label: 'No hay recetas', value: 'none', default: true }]
        );

    const selectRow = new ActionRowBuilder().addComponents(select);

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`craft:nav:${userId}:${safePage}:prev`)
            .setEmoji(EMOJIS.arrowLeft)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(prevDisabled),
        new ButtonBuilder()
            .setCustomId(`craft:home:${userId}`)
            .setEmoji(EMOJIS.package)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`craft:close:${userId}`)
            .setEmoji(EMOJIS.cross)
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`craft:info:${userId}`)
            .setEmoji(EMOJIS.question)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`craft:nav:${userId}:${safePage}:next`)
            .setEmoji(EMOJIS.arrowRight)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(nextDisabled)
    );

    return {
        content: `Página ${safePage + 1} de ${totalPages}`,
        embeds: [embed],
        components: [selectRow, buttonRow],
        __meta: { page: safePage, totalPages },
    };
}

function buildCraftResultEmbed({ title, text } = {}) {
    return new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle(title || 'Craft')
        .setDescription(text || '');
}

module.exports = {
    buildCraftMessage,
    buildCraftResultEmbed,
};
