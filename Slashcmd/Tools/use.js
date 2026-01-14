const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { ensureMongoConnection } = require('../../Util/mongoConnect');
const { getOrCreateEconomy } = require('../../Util/economyCore');
const { buildShopData } = require('../../Util/shopView');
const { getItemById } = require('../../Util/inventoryCatalog');

function isPositiveInt(n) {
    return Number.isInteger(n) && n > 0;
}

function normalize(str) {
    return String(str || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function resolveItemFromInput(raw) {
    const input = String(raw || '').trim();
    if (!input) return { ok: false, reason: 'missing' };

    const { byShopId, byItemId, allItems } = buildShopData();

    if (/^\d+$/.test(input)) {
        const shopId = Number(input);
        const entry = byShopId.get(shopId);
        if (!entry) return { ok: false, reason: 'unknown-shop-id', shopId };
        return { ok: true, itemId: entry.itemId, itemName: entry.name, via: 'shopId' };
    }

    if (input.includes('/')) {
        const byShop = byItemId.get(input);
        const item = getItemById(input);
        if (!byShop && !item) return { ok: false, reason: 'unknown-item-id', itemId: input };
        return { ok: true, itemId: input, itemName: byShop?.name || item?.name || input, via: 'itemId' };
    }

    const needle = normalize(input);
    const exact = allItems.filter((i) => normalize(i.name) === needle);
    if (exact.length === 1) {
        return { ok: true, itemId: exact[0].itemId, itemName: exact[0].name, via: 'name' };
    }

    const partial = allItems.filter((i) => normalize(i.name).includes(needle));
    if (partial.length === 1) {
        return { ok: true, itemId: partial[0].itemId, itemName: partial[0].name, via: 'name' };
    }

    const candidates = (exact.length ? exact : partial).slice(0, 10);
    return { ok: false, reason: 'ambiguous', candidates };
}

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Consume un ítem de tu inventario')
        .addStringOption((opt) =>
            opt
                .setName('item')
                .setDescription('ID de tienda, itemId o nombre')
                .setRequired(true)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('cantidad')
                .setDescription('Cantidad a consumir (opcional)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(999)
        ),

    async run(Moxi, interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!process.env.MONGODB) {
            return interaction.editReply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Use',
                        text: 'MongoDB no está configurado (MONGODB vacío).',
                    })
                )
            );
        }

        const rawItem = interaction.options.getString('item', true);
        const qty = interaction.options.getInteger('cantidad') || 1;
        const amount = isPositiveInt(Math.trunc(qty)) ? Math.trunc(qty) : 1;

        const resolved = resolveItemFromInput(rawItem);
        if (!resolved.ok) {
            if (resolved.reason === 'ambiguous') {
                const lines = resolved.candidates
                    .map((c) => `• **${c.name}** — ID tienda: **${c.shopId}**`)
                    .join('\n');
                return interaction.editReply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            title: 'Use',
                            text: `He encontrado varios ítems parecidos. Usa el **ID de tienda**:\n${lines}`,
                        })
                    )
                );
            }

            const msg =
                resolved.reason === 'unknown-shop-id'
                    ? `No existe un ítem con ID de tienda **${resolved.shopId}**. Mira IDs en /shop list.`
                    : resolved.reason === 'unknown-item-id'
                        ? `No existe el itemId **${resolved.itemId}**.`
                        : 'No pude resolver ese ítem.';

            return interaction.editReply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Use',
                        text: msg,
                    })
                )
            );
        }

        await ensureMongoConnection();
        const userId = interaction.user.id;
        const eco = await getOrCreateEconomy(userId);

        const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
        const row = inv.find((x) => x && x.itemId === resolved.itemId);
        const have = Math.max(0, Number(row?.amount) || 0);

        if (!row || have < amount) {
            return interaction.editReply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Use',
                        text: `No tienes suficientes unidades de **${resolved.itemName}**. Tienes **${have}**.`,
                    })
                )
            );
        }

        row.amount = have - amount;
        if (row.amount <= 0) {
            eco.inventory = inv.filter((x) => x && x.itemId !== resolved.itemId);
        } else {
            eco.inventory = inv;
        }
        await eco.save();

        return interaction.editReply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.check,
                    title: 'Use',
                    text: `Has consumido **${amount}x ${resolved.itemName}**.\nTe quedan **${Math.max(0, row.amount)}**.`,
                })
            ),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
