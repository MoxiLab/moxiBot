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

function normalizeBet(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return null;

    // number
    if (/^\d+$/.test(s)) {
        const n = safeInt(s, -1);
        if (n >= 0 && n <= 36) return { type: 'number', value: n, label: String(n) };
        return null;
    }

    // colors
    if (['red', 'rojo', 'r'].includes(s)) return { type: 'color', value: 'red', label: 'Rojo' };
    if (['black', 'negro', 'n'].includes(s)) return { type: 'color', value: 'black', label: 'Negro' };
    if (['green', 'verde', 'v', '0'].includes(s)) return { type: 'color', value: 'green', label: 'Verde' };

    // parity
    if (['even', 'par'].includes(s)) return { type: 'parity', value: 'even', label: 'Par' };
    if (['odd', 'impar'].includes(s)) return { type: 'parity', value: 'odd', label: 'Impar' };

    // high/low
    if (['low', 'bajo', '1-18', '1a18'].includes(s)) return { type: 'range', value: 'low', label: '1-18' };
    if (['high', 'alto', '19-36', '19a36'].includes(s)) return { type: 'range', value: 'high', label: '19-36' };

    // dozens
    if (['1st', '1ra', 'primera', 'docena1', 'docena-1', '1-12', '1a12'].includes(s)) return { type: 'dozen', value: 1, label: '1ª docena (1-12)' };
    if (['2nd', '2da', 'segunda', 'docena2', 'docena-2', '13-24', '13a24'].includes(s)) return { type: 'dozen', value: 2, label: '2ª docena (13-24)' };
    if (['3rd', '3ra', 'tercera', 'docena3', 'docena-3', '25-36', '25a36'].includes(s)) return { type: 'dozen', value: 3, label: '3ª docena (25-36)' };

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
    description: 'Juega a la ruleta y apuesta coins.',
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

        const amountRaw = String(args?.[0] || '').trim().toLowerCase();
        const betRaw = String(args?.slice(1).join(' ') || '').trim();

        if (!amountRaw || !betRaw) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.info || 'ℹ️',
                        title: 'Ruleta',
                        text: [
                            'Uso:',
                            `\`${prefix}roulette <cantidad|all> <apuesta>\``,
                            '',
                            'Apuestas: rojo/negro, par/impar, alto/bajo, docena1/2/3, o número 0-36.',
                            '',
                            `Ejemplos: \`${prefix}ruleta 100 rojo\` • \`${prefix}roulette all 17\``,
                        ].join('\n'),
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
                        title: 'Ruleta',
                        text: isMongoMissing
                            ? 'MongoDB no está configurado, el sistema de economía no está disponible.'
                            : 'No pude acceder a tu economía ahora mismo. Inténtalo de nuevo.',
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const balance = Math.max(0, safeInt(eco?.balance, 0));
        const betSpec = normalizeBet(betRaw);
        if (!betSpec) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Apuesta inválida',
                        text: 'Apuesta no reconocida. Usa: rojo/negro, par/impar, alto/bajo, docena1/2/3 o un número 0-36.',
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
                        title: 'Cantidad inválida',
                        text: 'La cantidad debe ser mayor que 0 (o usa `all`).',
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
                        title: 'Sin fondos',
                        text: 'No tienes coins para apostar. Consigue coins y vuelve a intentarlo.',
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
                        title: 'Fondos insuficientes',
                        text: `Intentaste apostar **${formatInt(amount)}** 🪙 pero tienes **${formatInt(balance)}** 🪙.`,
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const rolled = spinNumber();
        const rolledColor = colorOf(rolled);
        const outcome = evalBet(betSpec, rolled);

        // Apply balance change
        const baseAfter = balance - amount;
        const winBack = outcome.won ? amount * outcome.multiplier : 0;
        const newBalance = baseAfter + winBack;

        eco.balance = newBalance;
        await eco.save();

        const colorEmoji = rolledColor === 'red' ? '🔴' : (rolledColor === 'black' ? '⚫' : '🟢');
        const net = outcome.won ? (amount * (outcome.multiplier - 1)) : -amount;

        const resultTitle = outcome.won ? '🎉 ¡Ganaste!' : '💸 Perdiste';
        const resultEmoji = outcome.won ? (EMOJIS.check || '✅') : (EMOJIS.cross || '❌');

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: resultEmoji,
                    title: `Ruleta • ${resultTitle}`,
                    text: [
                        `**Apuesta:** ${betSpec.label}`,
                        `**Cantidad:** ${formatInt(amount)} 🪙`,
                        '',
                        `**Salió:** ${colorEmoji} **${rolled}** (${rolledColor})`,
                        outcome.won ? `**Premio:** +${formatInt(net)} 🪙` : `**Pérdida:** -${formatInt(Math.abs(net))} 🪙`,
                        '',
                        `Balance: **${formatInt(newBalance)}** 🪙`,
                    ].join('\n'),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
