const { MessageFlags } = require('discord.js');

const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { getItemById } = require('./inventoryCatalog');
const { listRecipes, getRecipeDisplayName, getMissingInputs, getDisplayNameForItem } = require('./craftSystem');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function clampInt(n, min, max) {
    const x = Number.parseInt(String(n), 10);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
}

function paginate(items, page, perPage) {
    const size = Math.max(1, Math.min(8, safeInt(perPage, 5)));
    const totalPages = Math.max(1, Math.ceil(items.length / size));
    const p = clampInt(page, 0, totalPages - 1);
    const start = p * size;
    return { slice: items.slice(start, start + size), page: p, totalPages, perPage: size };
}

function ingredientLabel(itemId) {
    const it = getItemById(itemId);
    return it?.name ? `**${it.name}**` : `**${itemId}**`;
}

function formatRecipeLine(r) {
    const outName = getRecipeDisplayName(r);
    const outQty = safeInt(r?.output?.amount, 1);
    const req = Array.isArray(r?.inputs) ? r.inputs : [];
    const reqText = req.map(i => `${safeInt(i.amount, 1)}x ${ingredientLabel(i.itemId)}`).join(' + ');
    return `${EMOJIS.hammer || '🛠️'} **${outName}** (x${outQty})\n${reqText}`;
}

function buildCraftListMessageOptions({ page = 0, perPage = 4 } = {}) {
    const recipes = listRecipes();
    const { slice, page: p, totalPages } = paginate(recipes, page, perPage);

    const lines = slice.map(formatRecipeLine);
    const text = lines.length
        ? lines.join(`\n\n${EMOJIS.dot || '•'} `).replace(/^/, `${EMOJIS.dot || '•'} `)
        : 'No hay recetas todavía.';

    // V2 container estilo "ping"
    const { ContainerBuilder } = require('discord.js');

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(t => t.setContent(`## 🛠️ Craft • Recetas`))
        .addTextDisplayComponents(t => t.setContent(`Página ${p + 1} de ${totalPages}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(text));

    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(t => t.setContent('Usa `craft <item>` para craftear.'));

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function buildCraftMissingMessage({ recipe, economyDoc } = {}) {
    const missing = getMissingInputs(economyDoc, recipe);
    const outName = getRecipeDisplayName(recipe);

    const lines = missing.map(m => {
        const name = getDisplayNameForItem(m.itemId);
        return `• **${name}**: tienes **${m.have}**, necesitas **${m.need}**`;
    });

    return {
        emoji: EMOJIS.cross,
        title: 'Materiales insuficientes',
        text: `No puedes craftear **${outName}**.\n\n${lines.join('\n')}`,
    };
}

module.exports = {
    buildCraftListMessageOptions,
    buildCraftMissingMessage,
};
