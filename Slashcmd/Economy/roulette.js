const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getOrCreateEconomyRaw } = require('../../Util/balanceView');

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

    const MAX_PCT = 0.25;
    const MAX_ABS = 5_000;
    const maxStake = Math.max(1, Math.min(Math.floor(b * MAX_PCT), MAX_ABS));
    return Math.min(desired, maxStake);
}

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

function spinNumber() {
    return Math.floor(Math.random() * 37);
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

    if (/^\d+$/.test(s)) {
        const n = safeInt(s, -1);
        if (n >= 0 && n <= 36) return { type: 'number', value: n, label: String(n) };
        return null;
    }

    if (['red', 'rojo', 'r'].includes(s)) return { type: 'color', value: 'red', label: isEs ? 'Rojo' : 'Red' };
    if (['black', 'negro', 'n'].includes(s)) return { type: 'color', value: 'black', label: isEs ? 'Negro' : 'Black' };
    if (['green', 'verde', 'v'].includes(s)) return { type: 'color', value: 'green', label: isEs ? 'Verde' : 'Green' };

    if (['even', 'par'].includes(s)) return { type: 'parity', value: 'even', label: isEs ? 'Par' : 'Even' };
    if (['odd', 'impar'].includes(s)) return { type: 'parity', value: 'odd', label: isEs ? 'Impar' : 'Odd' };

    if (['low', 'bajo', '1-18', '1a18'].includes(s)) return { type: 'range', value: 'low', label: '1-18' };
    if (['high', 'alto', '19-36', '19a36'].includes(s)) return { type: 'range', value: 'high', label: '19-36' };

    if (['1st', '1ra', 'primera', 'docena1', 'docena-1', '1-12', '1a12'].includes(s)) return { type: 'dozen', value: 1, label: isEs ? '1ª docena (1-12)' : '1st dozen (1-12)' };
    if (['2nd', '2da', 'segunda', 'docena2', 'docena-2', '13-24', '13a24'].includes(s)) return { type: 'dozen', value: 2, label: isEs ? '2ª docena (13-24)' : '2nd dozen (13-24)' };
    if (['3rd', '3ra', 'tercera', 'docena3', 'docena-3', '25-36', '25a36'].includes(s)) return { type: 'dozen', value: 3, label: isEs ? '3ª docena (25-36)' : '3rd dozen (25-36)' };

    return null;
}

function evalBet(bet, rolled) {
    if (!bet) return { won: false, multiplier: 0 };

    if (bet.type === 'number') return { won: rolled === bet.value, multiplier: 36 };

    if (bet.type === 'color') return { won: colorOf(rolled) === bet.value, multiplier: 2 };

    if (bet.type === 'parity') {
        if (rolled === 0) return { won: false, multiplier: 2 };
        const isEven = rolled % 2 === 0;
        const won = bet.value === 'even' ? isEven : !isEven;
        return { won, multiplier: 2 };
    }

    if (bet.type === 'range') {
        if (rolled === 0) return { won: false, multiplier: 2 };
        const won = bet.value === 'low'
            ? (rolled >= 1 && rolled <= 18)
            : (rolled >= 19 && rolled <= 36);
        return { won, multiplier: 2 };
    }

    if (bet.type === 'dozen') {
        if (rolled === 0) return { won: false, multiplier: 3 };
        const d = bet.value;
        const won = (d === 1 && rolled >= 1 && rolled <= 12)
            || (d === 2 && rolled >= 13 && rolled <= 24)
            || (d === 3 && rolled >= 25 && rolled <= 36);
        return { won, multiplier: 3 };
    }

    return { won: false, multiplier: 0 };
}

function economyCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
}

const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');
const { description, localizations } = getSlashCommandDescription('roulette');

module.exports = {
    cooldown: 2,
    Category: economyCategory,
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription(description)
        .setDescriptionLocalizations(localizations)
        .addIntegerOption((opt) =>
            opt
                .setName('cantidad')
                .setDescription('Cantidad a apostar')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000000)
        )
        .addStringOption((opt) =>
            opt
                .setName('apuesta')
                .setDescription('rojo/negro/par/impar/alto/bajo/docena1/2/3 o número 0-36')
                .setRequired(true)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/roulette:${k}`, lang, vars);

        const amount = interaction.options.getInteger('cantidad');
        const betRaw = interaction.options.getString('apuesta');
        const betSpec = normalizeBet(betRaw, lang);

        if (!betSpec) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: t('BET_INVALID_TITLE'),
                text: t('BET_INVALID'),
            });
            return interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        let eco;
        try {
            eco = await getOrCreateEconomyRaw(interaction.user.id);
        } catch (err) {
            const isMongoMissing = String(err?.message || '').toLowerCase().includes('mongodb');
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: t('TITLE'),
                text: isMongoMissing
                    ? t('MONGO_MISSING')
                    : t('ECONOMY_UNAVAILABLE'),
            });
            return interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        const balance = Math.max(0, safeInt(eco?.balance, 0));
        if (balance <= 0) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.info || 'ℹ️',
                title: t('NO_FUNDS_TITLE'),
                text: t('NO_FUNDS'),
            });
            return interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        if (amount > balance) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: t('INSUFFICIENT_TITLE'),
                text: t('INSUFFICIENT', { amount: formatInt(amount), balance: formatInt(balance) }),
            });
            return interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        const stake = clampStakeToBalance(balance, amount);
        const stakeCapped = stake !== amount;
        if (!stake || stake <= 0) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: t('AMOUNT_INVALID_TITLE'),
                text: t('AMOUNT_INVALID'),
            });
            return interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        const rolled = spinNumber();
        const rolledColor = colorOf(rolled);
        const outcome = evalBet(betSpec, rolled);

        const baseAfter = balance - stake;
        const winBack = outcome.won ? stake * outcome.multiplier : 0;
        const newBalance = baseAfter + winBack;

        eco.balance = newBalance;
        await eco.save();

        const colorEmoji = rolledColor === 'red' ? '🔴' : (rolledColor === 'black' ? '⚫' : '🟢');
        const net = outcome.won ? (stake * (outcome.multiplier - 1)) : -stake;
        const colorKey = rolledColor === 'red' ? 'COLOR_RED' : (rolledColor === 'black' ? 'COLOR_BLACK' : 'COLOR_GREEN');

        const container = buildNoticeContainer({
            emoji: outcome.won ? (EMOJIS.check || '✅') : (EMOJIS.cross || '❌'),
            title: `${t('TITLE')} • ${outcome.won ? t('RESULT_WIN') : t('RESULT_LOSE')}`,
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
        });

        return interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    },
};
