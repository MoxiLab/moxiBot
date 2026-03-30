const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { claimCooldown, formatDuration, getOrCreateEconomy } = require('../../Util/economyCore');

const { addToInventory } = require('../../Util/inventoryOps');
const { getItemById } = require('../../Util/inventoryCatalog');

const { economyCategory } = require('../../Util/commandCategories');
module.exports = {
    name: 'chop',
    alias: ['chop'],
    Category: economyCategory,
    usage: 'chop',
    description: 'commands:CMD_CHOP_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/chop:${k}`, lang, vars);

        const cooldownMs = 5 * 60 * 1000; // 5 min
        const cd = await claimCooldown({ userId: message.author.id, field: 'lastChop', cooldownMs });
        if (!cd.ok) {
            if (cd.reason === 'no-db') {
                return message.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('TITLE'), text: t('NO_DB') })),
                    allowedMentions: { repliedUser: false },
                });
            }

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.hourglass,
                        title: t('COOLDOWN_TITLE'),
                        text: t('COOLDOWN_TEXT', { next: formatDuration(cd.nextInMs) }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        try {
            const eco = await getOrCreateEconomy(message.author.id);

            // Loot simple (madera robusta común / madera encantada rara)
            const roll = Math.random();
            const itemId = roll < 0.12 ? 'materiales/madera-encantada' : 'materiales/madera-robusta';
            const amount = roll < 0.12 ? 1 : (roll < 0.55 ? 2 : 1);
            const coins = 10 + Math.floor(Math.random() * 21); // 10..30

            addToInventory(eco, itemId, amount);
            eco.balance = Math.max(0, Number(eco.balance || 0) + coins);
            await eco.save();

            const item = getItemById(itemId, { lang });
            const name = item?.name || itemId;

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🪓',
                        title: t('SUCCESS_TITLE'),
                        text: t('SUCCESS_TEXT', { item: name, amount, coins, balance: eco.balance }),
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
