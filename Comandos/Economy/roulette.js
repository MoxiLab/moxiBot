const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getOrCreateEconomyRaw } = require('../../Util/balanceView');
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

function clampStakeToBalance(balance, desiredStake) {
    const b = Math.max(0, safeInt(balance, 0));
    const desired = Math.max(0, safeInt(desiredStake, 0));
    if (b <= 0 || desired <= 0) return 0;

    // Evita pérdidas enormes en una sola jugada.
    const MAX_PCT = 0.25; // 25% del saldo
    const MAX_ABS = 5_000; // techo absoluto por jugada
    const maxStake = Math.max(1, Math.min(Math.floor(b * MAX_PCT), MAX_ABS));
    return Math.min(desired, maxStake);
}

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

function spinNumber() {
    return Math.floor(Math.random() * 37); // 0..36
}

function colorOf(n) {
    if (n === 0) return 'green';
    if (RED.has(n)) return 'red';
    if (BLACK.has(n)) return 'black';
    return 'green';
}

function normalizeBet(raw, lang) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return null;

    const isEs = /^es(-|$)/i.test(String(lang || ''));

    // number
    if (/^\d+$/.test(s)) {
        const n = safeInt(s, -1);
        if (n >= 0 && n <= 36) return { type: 'number', value: n, label: String(n) };
        return null;
    }

    // colors
    if (['red', 'rojo', 'r'].includes(s)) return { type: 'color', value: 'red', label: isEs ? 'Rojo' : 'Red' };
    if (['black', 'negro', 'n'].includes(s)) return { type: 'color', value: 'black', label: isEs ? 'Negro' : 'Black' };
    if (['green', 'verde', 'v', '0'].includes(s)) return { type: 'color', value: 'green', label: isEs ? 'Verde' : 'Green' };

    // parity
    if (['even', 'par'].includes(s)) return { type: 'parity', value: 'even', label: isEs ? 'Par' : 'Even' };
    if (['odd', 'impar'].includes(s)) return { type: 'parity', value: 'odd', label: isEs ? 'Impar' : 'Odd' };

    // high/low
    if (['low', 'bajo', '1-18', '1a18'].includes(s)) return { type: 'range', value: 'low', label: '1-18' };
    if (['high', 'alto', '19-36', '19a36'].includes(s)) return { type: 'range', value: 'high', label: '19-36' };

    // dozens
    if (['1st', '1ra', 'primera', 'docena1', 'docena-1', '1-12', '1a12'].includes(s)) return { type: 'dozen', value: 1, label: isEs ? '1ª docena (1-12)' : '1st dozen (1-12)' };
    if (['2nd', '2da', 'segunda', 'docena2', 'docena-2', '13-24', '13a24'].includes(s)) return { type: 'dozen', value: 2, label: isEs ? '2ª docena (13-24)' : '2nd dozen (13-24)' };
    if (['3rd', '3ra', 'tercera', 'docena3', 'docena-3', '25-36', '25a36'].includes(s)) return { type: 'dozen', value: 3, label: isEs ? '3ª docena (25-36)' : '3rd dozen (25-36)' };

    return null;
}

function evalBet(bet, rolled) {
    // returns { won:boolean, multiplier:number, reason:string }
    if (!bet) return { won: false, multiplier: 0, reason: 'Apuesta inválida' };

    if (bet.type === 'number') {
        const won = rolled === bet.value;
        return { won, multiplier: 36, reason: won ? 'Número exacto' : 'Número diferente' };
    }

    if (bet.type === 'color') {
        const won = colorOf(rolled) === bet.value;
        return { won, multiplier: 2, reason: won ? 'Color correcto' : 'Color diferente' };
    }

    if (bet.type === 'parity') {
        if (rolled === 0) return { won: false, multiplier: 2, reason: 'El 0 no cuenta como par/impar' };
        const isEven = rolled % 2 === 0;
        const won = bet.value === 'even' ? isEven : !isEven;
        return { won, multiplier: 2, reason: won ? 'Paridad correcta' : 'Paridad diferente' };
    }

    if (bet.type === 'range') {
        if (rolled === 0) return { won: false, multiplier: 2, reason: 'El 0 no cuenta en rango' };
        const won = bet.value === 'low'
            ? (rolled >= 1 && rolled <= 18)
            : (rolled >= 19 && rolled <= 36);
        return { won, multiplier: 2, reason: won ? 'Rango correcto' : 'Rango diferente' };
    }

    if (bet.type === 'dozen') {
        if (rolled === 0) return { won: false, multiplier: 3, reason: 'El 0 no cuenta en docenas' };
        const d = bet.value;
        const won = (d === 1 && rolled >= 1 && rolled <= 12)
            || (d === 2 && rolled >= 13 && rolled <= 24)
            || (d === 3 && rolled >= 25 && rolled <= 36);
        return { won, multiplier: 3, reason: won ? 'Docena correcta' : 'Docena diferente' };
    }

    return { won: false, multiplier: 0, reason: 'Apuesta inválida' };
}

module.exports = {
    name: 'roulette',
    alias: ['ruleta', 'rlt', 'rul', 'roul', 'rleta', 'rt'],
    Category: economyCategory,
    usage: 'roulette <cantidad|all> <rojo|negro|par|impar|alto|bajo|docena1|docena2|docena3|0-36>',
    description: 'commands:CMD_ROULETTE_DESC',
    examples: ['roulette 100 rojo', 'ruleta all negro', 'roulette 50 17', 'ruleta 200 docena2'],
    cooldown: 2,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');
        const t = (k, vars = {}) => moxi.translate(`economy/roulette:${k}`, lang, vars);

        const amountRaw = String(args?.[0] || '').trim().toLowerCase();
        const betRaw = String(args?.slice(1).join(' ') || '').trim();

        if (!amountRaw || !betRaw) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.info || 'ℹ️',
                        title: t('TITLE'),
                        text: t('USAGE', { prefix }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        let eco;
        try {
            eco = await getOrCreateEconomyRaw(message.author.id);
        } catch (err) {
            const isMongoMissing = String(err?.message || '').toLowerCase().includes('mongodb');
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('TITLE'),
                        text: isMongoMissing
                            ? t('MONGO_MISSING')
                            : t('ECONOMY_UNAVAILABLE'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const balance = Math.max(0, safeInt(eco?.balance, 0));
        const betSpec = normalizeBet(betRaw, lang);
        if (!betSpec) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('BET_INVALID_TITLE'),
                        text: t('BET_INVALID'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const wantsAll = ['all', 'todo', 'max'].includes(amountRaw);
        const amount = wantsAll ? balance : safeInt(amountRaw, 0);
        if (!amount || amount <= 0) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('AMOUNT_INVALID_TITLE'),
                        text: t('AMOUNT_INVALID'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        if (balance <= 0) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.info,
                        title: t('NO_FUNDS_TITLE'),
                        text: t('NO_FUNDS'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        if (amount > balance) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('INSUFFICIENT_TITLE'),
                        text: t('INSUFFICIENT', { amount: formatInt(amount), balance: formatInt(balance) }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const stake = clampStakeToBalance(balance, amount);
        const stakeCapped = stake !== amount;
        if (stake <= 0) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('AMOUNT_INVALID_TITLE'),
                        text: t('AMOUNT_INVALID'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const rolled = spinNumber();
        const rolledColor = colorOf(rolled);
        const outcome = evalBet(betSpec, rolled);

        // Apply balance change
        const baseAfter = balance - stake;
        const winBack = outcome.won ? stake * outcome.multiplier : 0;
        const newBalance = baseAfter + winBack;

        eco.balance = newBalance;
        await eco.save();

        const colorEmoji = rolledColor === 'red' ? '🔴' : (rolledColor === 'black' ? '⚫' : '🟢');
        const net = outcome.won ? (stake * (outcome.multiplier - 1)) : -stake;

        const resultTitle = outcome.won ? t('RESULT_WIN') : t('RESULT_LOSE');
        const resultEmoji = outcome.won ? (EMOJIS.check || '✅') : (EMOJIS.cross || '❌');
        const colorKey = rolledColor === 'red' ? 'COLOR_RED' : (rolledColor === 'black' ? 'COLOR_BLACK' : 'COLOR_GREEN');

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: resultEmoji,
                    title: `${t('TITLE')} • ${resultTitle}`,
                    text: [
                        t('BET_LINE', { bet: betSpec.label }),
                        stakeCapped
                            ? t('AMOUNT_CAPPED_LINE', { amount: formatInt(stake), requested: formatInt(amount) })
                            : t('AMOUNT_LINE', { amount: formatInt(stake) }),
                        stakeCapped ? t('CAP_NOTE') : '',
                        '',
                        t('ROLLED_LINE', { icon: colorEmoji, number: rolled, color: t(colorKey) }),
                        outcome.won
                            ? t('PRIZE_LINE', { amount: formatInt(net) })
                            : t('LOSS_LINE', { amount: formatInt(Math.abs(net)) }),
                        '',
                        t('BALANCE_LINE', { balance: formatInt(newBalance) }),
                    ].join('\n'),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
