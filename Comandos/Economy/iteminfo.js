const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { resolveItemFromInput } = require('../../Util/useItem');

function parsePositiveInt(value) {
    const n = Number.parseInt(String(value || '').trim(), 10);
    if (!Number.isFinite(n)) return null;
    return n > 0 ? n : null;
}

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
        // Lazy require (y evita throw si no hay Mongo)
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

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    name: 'iteminfo',
    alias: [
        'item',
        'infoitem',
        'infodelitem',
        'item-info',
        'itemi',
        'iinfo',
        'ii',
        'datitem',
    ],
    Category: economyCategory,
    usage: 'iteminfo <id|nombre|itemId>',
    description: 'Muestra información de un ítem por ID, nombre o itemId.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');

        const raw = Array.isArray(args) && args.length ? args.join(' ').trim() : '';
        if (!raw) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.info || 'ℹ️',
                        title: 'Iteminfo',
                        text: [
                            'Debes indicar un ítem por **ID**, **nombre** o **itemId**.',
                            '',
                            `Ejemplos:`,
                            `\`${prefix}iteminfo 1\``,
                            `\`${prefix}iteminfo Scroll de Impulso Moxi\``,
                            `\`${prefix}iteminfo buffs/scroll-de-impulso-moxi\``,
                        ].join('\n'),
                    })
                )
            );
        }

        const first = args?.[0];
        const shopId = parsePositiveInt(first);
        const resolved = resolveItemFromInput({ shopId: shopId || null, query: shopId ? null : raw });
        if (!resolved) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Ítem no encontrado',
                        text: `No encontré ese ítem. Puedes ver IDs con \`${prefix}shop list\` o tu inventario con \`${prefix}bag\`.`,
                    })
                )
            );
        }

        // Enriquecer info con datos de shop (categoría, rareza, precio, shopId)
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

        const owned = await getOwnedAmountSafe(message.author?.id, itemId);

        const useHint = effectiveShopId
            ? `\`${prefix}use ${effectiveShopId}\``
            : `\`${prefix}use ${itemId}\``;

        const lines = [
            `**Nombre:** ${name}`,
            description ? `**Descripción:** ${description}` : '',
            `**Rareza:** ${rarityPretty(rarity, lang)}`,
            `**Precio:** ${price} 🪙`,
            effectiveShopId ? `**ID tienda:** ${effectiveShopId}` : '',
            `**ItemId:** \`${itemId}\``,
            category ? `**Categoría:** ${category}` : '',
            owned == null ? '' : `**En tu mochila:** ${owned}`,
            '',
            `Usar: ${useHint}`,
        ].filter(Boolean);

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '📦',
                    title: 'Iteminfo',
                    text: lines.join('\n'),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
