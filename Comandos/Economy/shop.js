const { PermissionsBitField } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { buildShopData, buildShopMessage } = require('../../Util/shopView');

function isPositiveInt(n) {
    return Number.isInteger(n) && n > 0;
}

function parseListArgs(args) {
    const rest = Array.isArray(args) ? [...args] : [];
    let page = 0;

    // Si el último argumento es número, lo tratamos como página
    if (rest.length) {
        const maybePage = Number(rest[rest.length - 1]);
        if (Number.isFinite(maybePage) && isPositiveInt(Math.trunc(maybePage))) {
            page = Math.max(0, Math.trunc(maybePage) - 1);
            rest.pop();
        }
    }

    const rawCategoria = rest.join(' ').trim();
    return { page, rawCategoria };
}

module.exports = {
    name: 'shop',
    alias: ['tienda'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    usage: 'shop list [categoria] [pagina] | shop buy <id> [cantidad]',
    get description() {
        return 'Tienda: lista y compra ítems';
    },

    // Prefix command
    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || (await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES'));

        const sub = (args[0] || 'list').toLowerCase();
        const subArgs = args.slice(1);

        if (sub === 'help' || sub === 'ayuda') {
            const text = [
                '**Uso:**',
                '`/shop list` (slash) o con prefix: `.shop list [categoria] [pagina]`',
                '`.shop buy <id> [cantidad]`',
                '',
                '**Ejemplos:**',
                '`.shop list`',
                '`.shop list Herramientas 2`',
                '`.shop buy 10 2`',
            ].join('\n');

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.info,
                        title: 'Shop',
                        text,
                    })
                )
            );
        }

        if (sub === 'list' || sub === 'lista' || sub === 'l') {
            const { page, rawCategoria } = parseListArgs(subArgs);

            let categoryKey = 'all';
            if (rawCategoria) {
                const { categories } = buildShopData();
                const needle = String(rawCategoria).trim().toLowerCase();
                const match = categories.find((c) => c.key === needle || c.label.toLowerCase() === needle);
                if (match) categoryKey = match.key;
            }

            const payload = buildShopMessage({
                userId: message.author.id,
                categoryKey,
                page,
            });

            return message.reply(payload);
        }

        if (sub === 'buy' || sub === 'comprar' || sub === 'b') {
            const id = Number(subArgs[0]);
            const amount = subArgs[1] ? Number(subArgs[1]) : 1;

            if (!isPositiveInt(Math.trunc(id))) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Tienda',
                            text: 'Uso: `.shop buy <id> [cantidad]` (ej: `.shop buy 10 2`)',
                        })
                    )
                );
            }

            const qty = isPositiveInt(Math.trunc(amount)) ? Math.trunc(amount) : 1;

            const { byShopId } = buildShopData();
            const item = byShopId.get(Math.trunc(id));

            if (!item) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Tienda',
                            text: `No existe un ítem con ID ${Math.trunc(id)}. Usa \.shop list para ver los IDs.`,
                        })
                    )
                );
            }

            const { UserEconomy } = require('../../Models/EconomySchema');

            const userId = message.author.id;
            let eco = await UserEconomy.findOne({ userId });
            if (!eco) {
                eco = await UserEconomy.create({ userId, balance: 0, inventory: [] });
            }

            const price = Number.isFinite(item.price) ? item.price : 0;
            const cost = price * qty;

            if (cost <= 0) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Tienda',
                            text: 'Este ítem no se puede comprar (precio inválido).',
                        })
                    )
                );
            }

            if ((eco.balance || 0) < cost) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Fondos insuficientes',
                            text: `Necesitas ${cost} 🪙 y tienes ${eco.balance || 0} 🪙.`,
                        })
                    )
                );
            }

            const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
            const existing = inv.find((x) => x && x.itemId === item.itemId);
            if (existing) {
                existing.amount = (existing.amount || 0) + qty;
            } else {
                inv.push({ itemId: item.itemId, amount: qty, obtainedAt: new Date() });
            }
            eco.inventory = inv;
            eco.balance = (eco.balance || 0) - cost;
            await eco.save();

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.check,
                        title: 'Compra realizada',
                        text: `Compraste **${qty}x ${item.name}** por **${cost}** 🪙.`,
                    })
                )
            );
        }

        return message.reply(
            asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.info,
                    title: 'Shop',
                    text: 'Subcomando no válido. Usa `.shop help`',
                })
            )
        );
    },
};
