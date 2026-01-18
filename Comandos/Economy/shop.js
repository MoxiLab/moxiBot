const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { buildShopData, buildShopMessage } = require('../../Util/shopView');
const { resolveItemFromInput } = require('../../Util/useItem');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

module.exports = {
    name: 'moxishop',
    alias: ['shop', 'tienda', 'nekoshop', 'tiendamoxi', 'moxi-shop', 'shopmoxi'],
    Category: economyCategory,
    usage: 'moxishop list [categoria] [pagina] | moxishop buy <id|nombre|itemId> [cantidad]',
    description: 'Tienda: lista y compra ítems.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/shop:${k}`, lang, vars);

        const sub = (args?.[0] ? String(args[0]).trim().toLowerCase() : '');

        if (!sub || sub === 'list' || sub === 'lista') {
            // .shop list [categoria] [pagina]
            const rawCategoria = args?.[1] ? String(args[1]).trim() : '';
            const rawPagina = args?.[2] ? safeInt(args[2], 0) : 0;
            const page = rawPagina ? Math.max(0, rawPagina - 1) : 0;

            let categoryKey = 'all';
            if (rawCategoria) {
                const { categories } = buildShopData({ lang });
                const needle = rawCategoria.toLowerCase();
                const match = categories.find((c) => c.key === needle || String(c.label).toLowerCase() === needle);
                if (match) categoryKey = match.key;
            }

            const payload = buildShopMessage({ userId: message.author.id, categoryKey, page, lang });
            return message.reply({
                ...payload,
                allowedMentions: { repliedUser: false },
            });
        }

        if (sub === 'buy' || sub === 'comprar') {
            // .shop buy <id|nombre|itemId> [cantidad]
            const rawArgs = Array.isArray(args) ? args : [];
            const tail = rawArgs.slice(1);

            let amount = 1;
            let queryTokens = tail;

            const maybeAmount = tail.length >= 2 ? tail[tail.length - 1] : null;
            if (maybeAmount != null && /^\d+$/.test(String(maybeAmount).trim())) {
                amount = Math.max(1, safeInt(maybeAmount, 1));
                queryTokens = tail.slice(0, -1);
            }

            const rawQuery = queryTokens.map((t) => String(t)).join(' ').trim();
            const id = safeInt(rawQuery, 0);

            if (!rawQuery) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('SHOP_TITLE', {}) || 'Tienda',
                            text: t('USAGE_BUY'),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            const { byShopId, byItemId } = buildShopData({ lang });
            let item = null;

            if (id) {
                item = byShopId.get(id) || null;
            } else {
                const resolved = resolveItemFromInput({ query: rawQuery, lang });
                if (resolved?.shopId) {
                    item = byShopId.get(resolved.shopId) || null;
                } else if (resolved?.itemId) {
                    item = byItemId.get(resolved.itemId) || null;
                }
            }
            if (!item) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('SHOP_TITLE', {}) || 'Tienda',
                            text: id ? t('NOT_FOUND_BY_ID', { id }) : t('NOT_FOUND_GENERIC'),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            const { Economy } = require('../../Models/EconomySchema');
            const userId = message.author.id;
            let eco = await Economy.findOne({ userId });
            if (!eco) eco = await Economy.create({ userId, balance: 0, bank: 0, sakuras: 0 });

            const price = Number.isFinite(item.price) ? item.price : 0;
            const cost = price * amount;

            if (cost <= 0) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('SHOP_TITLE', {}) || 'Tienda',
                            text: t('INVALID_PRICE'),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            if ((eco.balance || 0) < cost) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('INSUFFICIENT_FUNDS_TITLE'),
                            text: t('INSUFFICIENT_FUNDS', { cost, balance: eco.balance || 0 }),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
            const existing = inv.find((x) => x && x.itemId === item.itemId);
            if (existing) existing.amount = (existing.amount || 0) + amount;
            else inv.push({ itemId: item.itemId, amount, obtainedAt: new Date() });

            eco.inventory = inv;
            eco.balance = (eco.balance || 0) - cost;
            await eco.save();

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.check,
                        title: t('PURCHASE_SUCCESS_TITLE'),
                        text: t('PURCHASE_SUCCESS', { amount, name: item.name, cost }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.info,
                    title: 'Tienda',
                    text: 'Uso: `.moxishop list [categoria] [pagina]` o `.moxishop buy <id> [cantidad]`',
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
