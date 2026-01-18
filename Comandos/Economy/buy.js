const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { buildShopData } = require('../../Util/shopView');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

module.exports = {
    name: 'buy',
    alias: ['comprar'],
    Category: economyCategory,
    usage: 'buy <item>',
    description: 'Compra un ítem de la tienda por su ID.',
    examples: ['buy 1', 'buy 10', 'buy pocion'],
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const id = safeInt(args?.[0], 0);
        const amount = Math.max(1, safeInt(args?.[1], 1));

        if (!id) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Item no especificado',
                        text: "Se supone que debes escribir `nombre` o `id` del ítem que quieres comprar",
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const { byShopId } = buildShopData();
        const item = byShopId.get(id);

        if (!item) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Tienda',
                        text: `No existe un ítem con ID ${id}. Usa .shop list para ver los IDs.`,
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
                        title: 'Tienda',
                        text: 'Este ítem no se puede comprar (precio inválido).',
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
                        title: 'Fondos insuficientes',
                        text: `Necesitas ${cost} 🪙 y tienes ${eco.balance || 0} 🪙.`,
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
                    title: 'Compra realizada',
                    text: `Compraste **${amount}x ${item.name}** por **${cost}** 🪙.`,
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
