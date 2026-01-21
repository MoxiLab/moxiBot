const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { ensureMongoConnection } = require('../../Util/mongoConnect');
const { Economy } = require('../../Models/EconomySchema');
const { getOrCreateEconomy, safeInt } = require('../../Util/economyCore');
const { addToInventory } = require('../../Util/inventoryOps');
const { loadCatalog, getItemById } = require('../../Util/inventoryCatalog');

const { economyCategory } = require('../../Util/commandCategories');

function hash01(input) {
    const s = String(input || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
}

function yyyyMmDd(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseSlot(raw) {
    const n = Number(String(raw || '').trim());
    if (!Number.isFinite(n)) return 0;
    return Math.trunc(n);
}

function buildOffers({ lang, guildId, userId }) {
    const catalog = loadCatalog({ lang });
    const flat = [];
    for (const cat of Array.isArray(catalog) ? catalog : []) {
        for (const it of Array.isArray(cat?.items) ? cat.items : []) {
            if (it?.id) flat.push(it.id);
        }
    }

    // Si por lo que sea no hay catálogo, devolvemos vacío.
    if (flat.length === 0) return [];

    const day = yyyyMmDd();
    const seedBase = `${day}|${guildId || 'dm'}|${userId}`;

    const offers = [];
    for (let slot = 1; slot <= 3; slot += 1) {
        const u = hash01(`${seedBase}|${slot}`);
        const idx = Math.max(0, Math.min(flat.length - 1, Math.floor(u * flat.length)));
        const itemId = flat[idx];

        const item = getItemById(itemId, { lang });

        // Precio “black market”: 0.85..1.30 del precio base
        const mult = 0.85 + hash01(`${seedBase}|p|${slot}`) * 0.45;
        const price = Math.max(1, Math.trunc((Number(item?.price) || 100) * mult));

        offers.push({
            slot,
            itemId,
            name: item?.name || itemId,
            rarity: item?.rarity || 'common',
            price,
        });
    }

    // Evitar duplicados (simple): si hay repetidos, variar el último
    if (offers[0]?.itemId && offers[1]?.itemId && offers[0].itemId === offers[1].itemId) {
        offers[1].itemId = flat[(flat.indexOf(offers[1].itemId) + 17) % flat.length];
        const item = getItemById(offers[1].itemId, { lang });
        offers[1].name = item?.name || offers[1].itemId;
        offers[1].rarity = item?.rarity || 'common';
    }
    if (offers[2]?.itemId && (offers[2].itemId === offers[0]?.itemId || offers[2].itemId === offers[1]?.itemId)) {
        offers[2].itemId = flat[(flat.indexOf(offers[2].itemId) + 41) % flat.length];
        const item = getItemById(offers[2].itemId, { lang });
        offers[2].name = item?.name || offers[2].itemId;
        offers[2].rarity = item?.rarity || 'common';
    }

    return offers;
}

module.exports = {
    name: 'blackmarket',
    alias: ['blackmarket', 'bm', 'mercadonegro'],
    Category: economyCategory,
    usage: 'blackmarket | blackmarket buy <1-3>',
    description: 'commands:CMD_BLACKMARKET_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/blackmarket:${k}`, lang, vars);

        const sub = String(args?.[0] || '').trim().toLowerCase();

        // Cargar economía (si no hay DB, damos un mensaje claro)
        let eco;
        try {
            eco = await getOrCreateEconomy(message.author.id);
        } catch {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('NO_DB_TITLE'),
                        text: t('NO_DB_TEXT'),
                    })
                )
            );
        }

        const offers = buildOffers({ lang, guildId, userId: message.author.id });

        if (sub === 'buy' || sub === 'comprar') {
            const slot = parseSlot(args?.[1]);
            const picked = offers.find(o => o.slot === slot);
            if (!picked) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('BAD_SLOT_TITLE'),
                            text: t('BAD_SLOT_TEXT'),
                        })
                    )
                );
            }

            const balance = safeInt(eco?.balance, 0);
            if (balance < picked.price) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('NO_FUNDS_TITLE'),
                            text: t('NO_FUNDS_TEXT', { price: picked.price, balance }),
                        })
                    )
                );
            }

            await ensureMongoConnection();

            const updated = await Economy.findOneAndUpdate(
                { userId: message.author.id, balance: { $gte: picked.price } },
                { $inc: { balance: -picked.price } },
                { new: true }
            );

            if (!updated) {
                const fresh = await Economy.findOne({ userId: message.author.id });
                const newBal = safeInt(fresh?.balance, balance);
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('NO_FUNDS_TITLE'),
                            text: t('NO_FUNDS_TEXT', { price: picked.price, balance: newBal }),
                        })
                    )
                );
            }

            addToInventory(updated, picked.itemId, 1);
            await updated.save();

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🕶️',
                        title: t('BOUGHT_TITLE'),
                        text: t('BOUGHT_TEXT', {
                            name: picked.name,
                            price: picked.price,
                            balance: safeInt(updated.balance, 0),
                        }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const balance = safeInt(eco?.balance, 0);
        const lines = offers.map(o => t('OFFER_LINE', {
            slot: o.slot,
            name: o.name,
            rarity: t(`RARITY_${String(o.rarity || 'common').toUpperCase()}`),
            price: o.price,
        })).join('\n');

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🕶️',
                    title: t('TITLE'),
                    text: `${t('BALANCE', { balance })}\n\n${lines}\n\n${t('HINT')}`,
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
