const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getOrCreateEconomyRaw } = require('../../Util/balanceView');
const { getBankInfo, formatInt } = require('../../Util/bankSystem');
const { ButtonBuilder, ButtonStyle } = require('discord.js');

const { economyCategory } = require('../../Util/commandCategories');
function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

// formatInt viene de bankSystem

function parseAmountArg(arg) {
    const raw = String(arg || '').trim().toLowerCase();
    if (!raw) return { kind: 'all' };
    if (raw === 'all' || raw === 'todo' || raw === 'max') return { kind: 'all' };
    if (/^\d+$/.test(raw)) return { kind: 'amount', amount: safeInt(raw, 0) };
    return { kind: 'invalid' };
}

module.exports = {
    name: 'deposit',
    alias: ['depositar', 'dep'],
    Category: economyCategory,
    usage: 'deposit [cantidad]',
    description: 'commands:CMD_DEPOSIT_DESC',
    examples: ['deposit', 'deposit 100', 'deposit all'],
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const prefix = await moxi.guildPrefix(guildId, '.');
        const t = (k, vars = {}) => moxi.translate(`economy/deposit:${k}`, lang, vars);

        const parsed = parseAmountArg(args?.[0]);
        if (parsed.kind === 'invalid') {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('INVALID_USAGE_TITLE'),
                        text: t('INVALID_USAGE_TEXT', { prefix }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        try {
            const eco = await getOrCreateEconomyRaw(message.author.id);
            const bal = Math.max(0, safeInt(eco?.balance, 0));
            const bank = Math.max(0, safeInt(eco?.bank, 0));
            const bankInfo = getBankInfo(eco);

            if (bal <= 0) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            title: t('BANK_TITLE'),
                            text: t('NO_COINS'),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            const wanted = parsed.kind === 'all' ? bal : Math.max(0, safeInt(parsed.amount, 0));
            if (wanted <= 0) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('INVALID_AMOUNT_TITLE'),
                            text: t('INVALID_AMOUNT_TEXT'),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            if (wanted > bal) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('INSUFFICIENT_FUNDS_TITLE'),
                            text: t('INSUFFICIENT_FUNDS_TEXT', { wanted: formatInt(wanted), balance: formatInt(bal) }),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            // Capacidad de banco (mejorable, sin tope máximo global)
            if (bankInfo.free <= 0 || (bank + wanted) > bankInfo.capacity) {
                const container = buildNoticeContainer({
                    emoji: EMOJIS.hourglass,
                    title: 'Banco lleno',
                    text:
                        `Tu banco está al **límite**.\n` +
                        `Banco: **${formatInt(bank)} / ${formatInt(bankInfo.capacity)}** 🏦 (Lv **${formatInt(bankInfo.level)}**)\n\n` +
                        `Para aumentar la capacidad, compra **Expansión de Banco** en la tienda.\n` +
                        `Coste de la siguiente mejora: **${formatInt(bankInfo.nextCost)}** 🪙\n\n` +
                        `Compra: \`${prefix}buy mejoras/expansion-de-banco\``,
                });
                container.addSeparatorComponents(s => s.setDivider(true));
                container.addActionRowComponents(r => r.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop:home:${message.author.id}:upgrades`)
                        .setEmoji('🛒')
                        .setLabel('Abrir tienda (Mejoras)')
                        .setStyle(ButtonStyle.Secondary)
                ));
                return message.reply({
                    ...asV2MessageOptions(container),
                    allowedMentions: { repliedUser: false },
                });
            }

            eco.balance = bal - wanted;
            eco.bank = bank + wanted;
            await eco.save();

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.check,
                        title: t('DEPOSIT_SUCCESS_TITLE'),
                        text: t('DEPOSIT_SUCCESS_TEXT', { wanted: formatInt(wanted), balance: formatInt(eco.balance), bank: formatInt(eco.bank) }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        } catch (err) {
            const isMongoMissing = String(err?.message || '').toLowerCase().includes('mongodb');
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: isMongoMissing ? t('ERROR_MONGO') : t('ERROR_GENERIC'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
