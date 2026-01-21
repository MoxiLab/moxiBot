const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { resolveItemFromInput } = require('../../Util/useItem');

const { economyCategory } = require('../../Util/commandCategories');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function formatInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return Math.trunc(x).toLocaleString('en-US');
}

module.exports = {
    name: 'sell',
    alias: ['sell'],
    Category: economyCategory,
    usage: 'sell <id|nombre|itemId> [cantidad]',
    description: 'commands:CMD_SELL_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');
        const t = (k, vars = {}) => moxi.translate(`economy/sell:${k}`, lang, vars);

        if (!process.env.MONGODB) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('TITLE'), text: t('NO_DB') })),
                allowedMentions: { repliedUser: false },
            });
        }

        const rawArgs = Array.isArray(args) ? args : [];
        if (!rawArgs.length) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.info, title: t('TITLE'), text: t('USAGE', { prefix }) })),
                allowedMentions: { repliedUser: false },
            });
        }

        let amount = 1;
        let queryTokens = rawArgs;
        const last = rawArgs[rawArgs.length - 1];
        if (last != null && /^\d+$/.test(String(last).trim())) {
            amount = Math.max(1, safeInt(last, 1));
            queryTokens = rawArgs.slice(0, -1);
        }

        const query = queryTokens.join(' ').trim();
        if (!query) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.info, title: t('TITLE'), text: t('USAGE', { prefix }) })),
                allowedMentions: { repliedUser: false },
            });
        }

        const resolved = resolveItemFromInput({ query, lang });
        if (!resolved?.itemId) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('NOT_FOUND_TITLE'), text: t('NOT_FOUND_TEXT') })),
                allowedMentions: { repliedUser: false },
            });
        }

        try {
            // eslint-disable-next-line global-require
            const { ensureMongoConnection } = require('../../Util/mongoConnect');
            await ensureMongoConnection();
            // eslint-disable-next-line global-require
            const { Economy } = require('../../Models/EconomySchema');
            // eslint-disable-next-line global-require
            const { buildShopData } = require('../../Util/shopView');

            const userId = message.author.id;
            let eco = await Economy.findOne({ userId });
            if (!eco) eco = await Economy.create({ userId, balance: 0, bank: 0, sakuras: 0 });

            const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
            const row = inv.find((x) => x && String(x.itemId) === String(resolved.itemId));
            const have = row ? Math.max(0, Number(row.amount) || 0) : 0;

            if (!row || have <= 0) {
                return message.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('NOT_OWNED_TITLE'), text: t('NOT_OWNED_TEXT') })),
                    allowedMentions: { repliedUser: false },
                });
            }

            if (amount > have) amount = have;

            const { byItemId } = buildShopData({ lang });
            const shopItem = byItemId.get(String(resolved.itemId)) || null;
            const basePrice = Number.isFinite(Number(shopItem?.price)) ? Math.max(1, Math.trunc(Number(shopItem.price))) : 100;
            const unitSell = Math.max(1, Math.floor(basePrice * 0.5));
            const total = unitSell * amount;

            row.amount = have - amount;
            eco.inventory = row.amount <= 0 ? inv.filter((x) => x && String(x.itemId) !== String(resolved.itemId)) : inv;
            eco.balance = Math.max(0, Number(eco.balance || 0) + total);
            await eco.save();

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '💰',
                        title: t('SOLD_TITLE'),
                        text: t('SOLD_TEXT', {
                            amount,
                            name: resolved.name || resolved.itemId,
                            total: formatInt(total),
                            balance: formatInt(eco.balance),
                        }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        } catch {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('TITLE'), text: t('ERROR') })),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
