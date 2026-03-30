const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { transferBalance, transferInventoryItem } = require('../../Util/economyCore');
const { resolveItemFromInput } = require('../../Util/useItem');
const { getItemById } = require('../../Util/inventoryCatalog');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'gift',
    alias: ['gift'],
    Category: economyCategory,
    usage: 'gift [coins|item] <@usuario|id> <cantidad|item...>',
    description: 'commands:CMD_GIFT_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/gift:${k}`, lang, vars);

        const safeInt = (n, fallback = 0) => {
            const x = Number(n);
            return Number.isFinite(x) ? Math.trunc(x) : fallback;
        };
        const formatInt = (n) => {
            const x = Number(n);
            if (!Number.isFinite(x)) return '0';
            return Math.trunc(x).toLocaleString('en-US');
        };

        function pickFirstNumberToken(list) {
            const arr = Array.isArray(list) ? list : [];
            const token = arr.find(a => /^\d+$/.test(String(a || '').trim()));
            return token ? String(token).trim() : null;
        }

        async function resolveTargetUser({ client, message, args }) {
            const mention = message.mentions?.users?.first?.() || null;
            if (mention) return mention;

            const arr = Array.isArray(args) ? args : [];
            const idTok = arr.find(a => {
                const s = String(a || '').trim();
                if (!s) return false;
                return /^\d{15,20}$/.test(s);
            });

            if (idTok) {
                return client.users.fetch(String(idTok).trim()).catch(() => null);
            }

            return null;
        }

        const arr = Array.isArray(args) ? args : [];
        const modeRaw = String(arr[0] || '').trim().toLowerCase();

        const coinModes = new Set(['coins', 'coin', 'money', 'cash', 'dinero', 'moneda', 'monedas']);
        const itemModes = new Set(['item', 'items', 'objeto', 'objetos', 'itemes']);

        const mode = itemModes.has(modeRaw) ? 'item' : 'coins';
        const rest = (coinModes.has(modeRaw) || itemModes.has(modeRaw)) ? arr.slice(1) : arr;

        const target = await resolveTargetUser({ client: Moxi, message, args: rest });
        if (!target) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('USAGE_TITLE'),
                        text: t('USAGE_TEXT', { prefix: process.env.PREFIX || '.' }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        if (String(target.id) === String(message.author.id)) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('SELF_TITLE'),
                        text: t('SELF_TEXT'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        if (target.bot) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('BOT_TITLE'),
                        text: t('BOT_TEXT'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        if (mode === 'coins') {
            const amountTok = pickFirstNumberToken(rest);
            const amount = amountTok ? safeInt(amountTok, 0) : 0;

            if (!amountTok) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('USAGE_TITLE'),
                            text: t('USAGE_TEXT', { prefix: process.env.PREFIX || '.' }),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            if (amount <= 0) {
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

            try {
                const res = await transferBalance({ fromUserId: message.author.id, toUserId: target.id, amount });

                if (!res.ok) {
                    if (res.reason === 'no-db') {
                        return message.reply({
                            ...asV2MessageOptions(
                                buildNoticeContainer({
                                    emoji: EMOJIS.cross,
                                    title: t('NO_DB_TITLE'),
                                    text: t('NO_DB_TEXT'),
                                })
                            ),
                            allowedMentions: { repliedUser: false },
                        });
                    }

                    if (res.reason === 'insufficient') {
                        return message.reply({
                            ...asV2MessageOptions(
                                buildNoticeContainer({
                                    emoji: EMOJIS.cross,
                                    title: t('INSUFFICIENT_TITLE'),
                                    text: t('INSUFFICIENT_TEXT', { amount: formatInt(amount), balance: formatInt(res.balance ?? 0) }),
                                })
                            ),
                            allowedMentions: { repliedUser: false },
                        });
                    }

                    return message.reply({
                        ...asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('ERROR_TITLE'),
                                text: t('UNKNOWN_ERROR'),
                            })
                        ),
                        allowedMentions: { repliedUser: false },
                    });
                }

                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '🎁',
                            title: t('SUCCESS_TITLE'),
                            text: t('SUCCESS_TEXT', { user: `<@${target.id}>`, amount: formatInt(res.amount), balance: formatInt(res.fromBalance) }),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            } catch {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('ERROR_TITLE'),
                            text: t('UNKNOWN_ERROR'),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }
        }

        // mode === 'item'
        const targetTokIndex = rest.findIndex((x) => {
            const s = String(x || '').trim();
            return s === String(target.id) || s === `<@${target.id}>` || s === `<@!${target.id}>`;
        });
        const afterTarget = targetTokIndex >= 0 ? rest.slice(targetTokIndex + 1) : rest.slice(1);

        if (!afterTarget.length) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ITEM_USAGE_TITLE'),
                        text: t('ITEM_USAGE_TEXT', { prefix: process.env.PREFIX || '.' }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        let qty = 1;
        let shopId = null;
        let query = null;

        const first = String(afterTarget[0] || '').trim();
        const second = String(afterTarget[1] || '').trim();

        if (/^\d+$/.test(first)) {
            if (afterTarget.length === 1) {
                // Solo número: asumimos shopId
                shopId = safeInt(first, null);
                qty = 1;
            } else if (/^\d+$/.test(second)) {
                // Dos números: shopId + cantidad
                shopId = safeInt(first, null);
                qty = Math.max(1, safeInt(second, 1));
            } else {
                // Número + texto: cantidad + nombre de ítem
                qty = Math.max(1, safeInt(first, 1));
                query = afterTarget.slice(1).join(' ').trim();
            }
        } else {
            query = afterTarget.join(' ').trim();
            qty = 1;
        }

        if (!Number.isFinite(qty) || qty <= 0) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ITEM_INVALID_AMOUNT_TITLE'),
                        text: t('ITEM_INVALID_AMOUNT_TEXT'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const resolved = resolveItemFromInput({ shopId, query, lang });
        if (!resolved?.itemId) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ITEM_INVALID_ITEM_TITLE'),
                        text: t('ITEM_INVALID_ITEM_TEXT', { prefix: process.env.PREFIX || '.' }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const item = getItemById(resolved.itemId, { lang });
        const displayName = item?.name || resolved.name || resolved.itemId;

        try {
            const res = await transferInventoryItem({ fromUserId: message.author.id, toUserId: target.id, itemId: resolved.itemId, amount: qty });

            if (!res.ok) {
                if (res.reason === 'no-db') {
                    return message.reply({
                        ...asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('NO_DB_TITLE'),
                                text: t('NO_DB_TEXT'),
                            })
                        ),
                        allowedMentions: { repliedUser: false },
                    });
                }

                if (res.reason === 'not-owned') {
                    return message.reply({
                        ...asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('ITEM_NOT_OWNED_TITLE'),
                                text: t('ITEM_NOT_OWNED_TEXT', { item: displayName }),
                            })
                        ),
                        allowedMentions: { repliedUser: false },
                    });
                }

                if (res.reason === 'not-enough') {
                    return message.reply({
                        ...asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('ITEM_NOT_ENOUGH_TITLE'),
                                text: t('ITEM_NOT_ENOUGH_TEXT', { amount: formatInt(qty), have: formatInt(res.have ?? 0), item: displayName }),
                            })
                        ),
                        allowedMentions: { repliedUser: false },
                    });
                }

                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('ERROR_TITLE'),
                            text: t('UNKNOWN_ERROR'),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🎁',
                        title: t('ITEM_SUCCESS_TITLE'),
                        text: t('ITEM_SUCCESS_TEXT', { user: `<@${target.id}>`, amount: formatInt(res.amount), item: displayName, remaining: formatInt(res.fromRemaining) }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        } catch {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: t('UNKNOWN_ERROR'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
