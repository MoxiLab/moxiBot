const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { buildNoticeContainer } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { resolveItemFromInput } = require('../../Util/useItem');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('iteminfo');

function rarityPretty(rarity, lang = 'es-ES') {
    const r = String(rarity || '').trim().toLowerCase();
    const es = String(lang || '').toLowerCase().startsWith('es');
    const mapEs = {
        common: 'Común',
        uncommon: 'Poco común',
        rare: 'Raro',
        epic: 'Épico',
        legendary: 'Legendario',
    };
    const mapEn = {
        common: 'Common',
        uncommon: 'Uncommon',
        rare: 'Rare',
        epic: 'Epic',
        legendary: 'Legendary',
    };
    return (es ? mapEs : mapEn)[r] || (rarity ? String(rarity) : (es ? 'Común' : 'Common'));
}

async function getOwnedAmountSafe(userId, itemId) {
    if (!process.env.MONGODB) return null;
    try {
        // eslint-disable-next-line global-require
        const { getOrCreateEconomy } = require('../../Util/economyCore');
        const eco = await getOrCreateEconomy(userId);
        const inv = Array.isArray(eco?.inventory) ? eco.inventory : [];
        const row = inv.find((x) => x && x.itemId === itemId);
        const have = row ? Math.max(0, Number(row.amount) || 0) : 0;
        return have;
    } catch {
        return null;
    }
}

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('iteminfo')
        .setDescription(description)
        .setDescriptionLocalizations(localizations)
        .addIntegerOption((opt) =>
            opt
                .setName('id')
                .setDescription('ID del ítem (se ve en /shop list y /bag)')
                .setRequired(false)
                .setMinValue(1)
        )
        .addStringOption((opt) =>
            opt
                .setName('item')
                .setDescription('Nombre o itemId del ítem (alternativa a id)')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const shopId = interaction.options.getInteger('id');
        const rawItem = interaction.options.getString('item');

        if (!shopId && !rawItem) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.info || 'ℹ️',
                title: 'Iteminfo',
                text: 'Indica un ítem por **id** o por **nombre/itemId**.',
            });
            return interaction.reply({ content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        const resolved = resolveItemFromInput({ shopId: shopId || null, query: rawItem || null });
        if (!resolved) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'Ítem no encontrado',
                text: 'No encontré ese ítem. Usa /shop list o /bag para ver IDs.',
            });
            return interaction.reply({ content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        let shop = null;
        try {
            // eslint-disable-next-line global-require
            const { buildShopData } = require('../../Util/shopView');
            const { byItemId } = buildShopData({ lang });
            shop = byItemId.get(resolved.itemId) || null;
        } catch {
            shop = null;
        }

        const itemId = resolved.itemId;
        const name = shop?.name || resolved.name || itemId;
        const description = shop?.description || resolved.description || '';
        const rarity = shop?.rarity || 'common';
        const price = Number.isFinite(shop?.price) ? shop.price : 0;
        const category = shop?.categoryLabel || '—';
        const effectiveShopId = Number.isFinite(shop?.shopId) ? shop.shopId : (resolved.shopId || null);

        const owned = await getOwnedAmountSafe(interaction.user?.id, itemId);

        const lines = [
            `**Nombre:** ${name}`,
            description ? `**Descripción:** ${description}` : '',
            `**Rareza:** ${rarityPretty(rarity, lang)}`,
            `**Precio:** ${price} 🪙`,
            effectiveShopId ? `**ID tienda:** ${effectiveShopId}` : '',
            `**ItemId:** \`${itemId}\``,
            category ? `**Categoría:** ${category}` : '',
            owned == null ? '' : `**En tu mochila:** ${owned}`,
        ].filter(Boolean);

        const container = buildNoticeContainer({
            emoji: '📦',
            title: 'Iteminfo',
            text: lines.join('\n'),
        });

        return interaction.reply({ content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    },
};
