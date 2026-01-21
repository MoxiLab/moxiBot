const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getOrCreateEconomy, awardBalance, safeInt } = require('../../Util/economyCore');

const { economyCategory } = require('../../Util/commandCategories');

function parseAmount(raw) {
    const n = Number(String(raw || '').replace(/[^0-9]/g, ''));
    if (!Number.isFinite(n)) return 0;
    return Math.trunc(n);
}

module.exports = {
    name: 'invest',
    alias: ['invest', 'inversion', 'invertir'],
    Category: economyCategory,
    usage: 'invest <cantidad>',
    description: 'commands:CMD_INVEST_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/invest:${k}`, lang, vars);

        const amount = parseAmount(args?.[0]);
        if (amount <= 0) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('BAD_AMOUNT_TITLE'),
                        text: t('BAD_AMOUNT_TEXT'),
                    })
                )
            );
        }

        let eco;
        try {
            eco = await getOrCreateEconomy(message.author.id);
        } catch (e) {
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

        const balance = safeInt(eco?.balance, 0);
        if (balance < amount) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('NO_FUNDS_TITLE'),
                        text: t('NO_FUNDS_TEXT', { amount, balance }),
                    })
                )
            );
        }

        // Resultado: 52% perder, 48% ganar (simple, riesgo moderado)
        const win = Math.random() < 0.48;

        if (!win) {
            // Debitar
            const { ensureMongoConnection } = require('../../Util/mongoConnect');
            const { Economy } = require('../../Models/EconomySchema');
            await ensureMongoConnection();

            const updated = await Economy.findOneAndUpdate(
                { userId: message.author.id, balance: { $gte: amount } },
                { $inc: { balance: -amount } },
                { new: true }
            );

            const newBal = safeInt(updated?.balance, balance);

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '📉',
                        title: t('LOSE_TITLE'),
                        text: t('LOSE_TEXT', { amount, balance: newBal }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        // Ganancia: +15% .. +85% (solo se gana el profit, no se “duplica” el stake)
        const profit = Math.max(1, Math.trunc(amount * (0.15 + Math.random() * 0.70)));
        const res = await awardBalance({ userId: message.author.id, amount: profit });

        if (!res.ok) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: res.message || t('UNKNOWN_ERROR'),
                    })
                )
            );
        }

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '📈',
                    title: t('WIN_TITLE'),
                    text: t('WIN_TEXT', { profit, balance: res.balance }),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
