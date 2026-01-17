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

function normalizeBet(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return null;

    if (/^\d+$/.test(s)) {
        const n = safeInt(s, -1);
        if (n >= 0 && n <= 36) return { type: 'number', value: n, label: String(n) };
        return null;
    }

    if (['red', 'rojo', 'r'].includes(s)) return { type: 'color', value: 'red', label: 'Rojo' };
    if (['black', 'negro', 'n'].includes(s)) return { type: 'color', value: 'black', label: 'Negro' };
    if (['green', 'verde', 'v'].includes(s)) return { type: 'color', value: 'green', label: 'Verde' };

    if (['even', 'par'].includes(s)) return { type: 'parity', value: 'even', label: 'Par' };
    if (['odd', 'impar'].includes(s)) return { type: 'parity', value: 'odd', label: 'Impar' };

    if (['low', 'bajo', '1-18', '1a18'].includes(s)) return { type: 'range', value: 'low', label: '1-18' };
    if (['high', 'alto', '19-36', '19a36'].includes(s)) return { type: 'range', value: 'high', label: '19-36' };

    if (['1st', '1ra', 'primera', 'docena1', 'docena-1', '1-12', '1a12'].includes(s)) return { type: 'dozen', value: 1, label: '1ª docena (1-12)' };
    if (['2nd', '2da', 'segunda', 'docena2', 'docena-2', '13-24', '13a24'].includes(s)) return { type: 'dozen', value: 2, label: '2ª docena (13-24)' };
    if (['3rd', '3ra', 'tercera', 'docena3', 'docena-3', '25-36', '25a36'].includes(s)) return { type: 'dozen', value: 3, label: '3ª docena (25-36)' };

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
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    cooldown: 2,
    Category: economyCategory,
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Juega a la ruleta y apuesta coins')
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

        const amount = interaction.options.getInteger('cantidad');
        const betRaw = interaction.options.getString('apuesta');
        const betSpec = normalizeBet(betRaw);

        if (!betSpec) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'Apuesta inválida',
                text: 'Apuesta no reconocida. Usa: rojo/negro, par/impar, alto/bajo, docena1/2/3 o un número 0-36.',
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
                title: 'Ruleta',
                text: isMongoMissing
                    ? 'MongoDB no está configurado, el sistema de economía no está disponible.'
                    : 'No pude acceder a tu economía ahora mismo. Inténtalo de nuevo.',
            });
            return interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        const balance = Math.max(0, safeInt(eco?.balance, 0));
        if (balance <= 0) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.info || 'ℹ️',
                title: 'Sin fondos',
                text: 'No tienes coins para apostar.',
            });
            return interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        if (amount > balance) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'Fondos insuficientes',
                text: `Intentaste apostar **${formatInt(amount)}** 🪙 pero tienes **${formatInt(balance)}** 🪙.`,
            });
            return interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        const rolled = spinNumber();
        const rolledColor = colorOf(rolled);
        const outcome = evalBet(betSpec, rolled);

        const baseAfter = balance - amount;
        const winBack = outcome.won ? amount * outcome.multiplier : 0;
        const newBalance = baseAfter + winBack;

        eco.balance = newBalance;
        await eco.save();

        const colorEmoji = rolledColor === 'red' ? '🔴' : (rolledColor === 'black' ? '⚫' : '🟢');
        const net = outcome.won ? (amount * (outcome.multiplier - 1)) : -amount;

        const container = buildNoticeContainer({
            emoji: outcome.won ? (EMOJIS.check || '✅') : (EMOJIS.cross || '❌'),
            title: outcome.won ? 'Ruleta • ¡Ganaste!' : 'Ruleta • Perdiste',
            text: [
                `**Apuesta:** ${betSpec.label}`,
                `**Cantidad:** ${formatInt(amount)} 🪙`,
                '',
                `**Salió:** ${colorEmoji} **${rolled}** (${rolledColor})`,
                outcome.won ? `**Premio:** +${formatInt(net)} 🪙` : `**Pérdida:** -${formatInt(Math.abs(net))} 🪙`,
                '',
                `Balance: **${formatInt(newBalance)}** 🪙`,
            ].join('\n'),
        });

        return interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    },
};
