const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getOrCreateEconomyRaw } = require('../../Util/balanceView');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function formatInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return Math.trunc(x).toLocaleString('en-US');
}

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
    description: 'Deposita coins desde tu balance al banco.',
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

        const parsed = parseAmountArg(args?.[0]);
        if (parsed.kind === 'invalid') {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Uso incorrecto',
                        text: 'Usa: `.deposit 100` o `.deposit all`.',
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        try {
            const eco = await getOrCreateEconomyRaw(message.author.id);
            const bal = Math.max(0, safeInt(eco?.balance, 0));
            const bank = Math.max(0, safeInt(eco?.bank, 0));

            if (bal <= 0) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            title: 'Banco',
                            text: 'No tienes coins para depositar.',
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
                            title: 'Cantidad inválida',
                            text: 'La cantidad debe ser mayor que 0, o usa `all`.',
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
                            title: 'Fondos insuficientes',
                            text: `Intentaste depositar **${formatInt(wanted)}** 🪙 pero solo tienes **${formatInt(bal)}** 🪙.`,
                        })
                    ),
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
                        title: 'Depósito realizado',
                        text: `Depositaste **${formatInt(wanted)}** 🪙.\nBalance: **${formatInt(eco.balance)}** 🪙\nBanco: **${formatInt(eco.bank)}** 🏦`,
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
                        title: 'Error',
                        text: isMongoMissing
                            ? 'MongoDB no está configurado, el banco no está disponible.'
                            : 'No pude hacer el depósito ahora mismo. Inténtalo de nuevo.',
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
