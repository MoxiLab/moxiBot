const { ContainerBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');

const moxi = require('../i18n');
const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { ensureMongoConnection } = require('./mongoConnect');
const { normalizeDiscordId } = require('./idGuards');

function clampPct(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(5, x));
}

function formatPct(x) {
    const v = clampPct(x);
    return `+${Math.round(v * 100)}%`;
}

function parseBuffsCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('buffs:')) return null;
    const parts = raw.split(':');
    // buffs:action:userId
    const action = parts[1] || null;
    const userId = normalizeDiscordId(parts[2]) || null;
    if (!action || !userId) return null;
    return { action, userId };
}

async function getOrCreateEconomy(userId) {
    const uid = normalizeDiscordId(userId);
    if (!uid) return null;
    if (!process.env.MONGODB) return null;
    await ensureMongoConnection();
    const { Economy } = require('../Models/EconomySchema');

    try {
        await Economy.updateOne(
            { userId: uid },
            { $setOnInsert: { userId: uid, balance: 0, bank: 0, bankLevel: 0, sakuras: 0, inventory: [] } },
            { upsert: true }
        );
    } catch (e) {
        if (e?.code !== 11000) throw e;
    }

    return Economy.findOne({ userId: uid });
}

function computeLootBonusesFromInventory(inv = []) {
    const owned = new Set(
        (Array.isArray(inv) ? inv : [])
            .filter(Boolean)
            .map((x) => String(x.itemId || ''))
            .filter(Boolean)
    );

    // Nota: el proyecto aún no tiene un sistema persistente de buffs “activos”.
    // Aquí calculamos bonos "pasivos" por tener ciertas mejoras/buffs en el inventario.
    let bestItems = 0;
    let mining = 0;
    let fishing = 0;
    let server = 0;

    if (owned.has('mejoras/estrella-de-suerte')) bestItems += 0.05;
    if (owned.has('mejoras/potenciador-de-fortuna')) {
        bestItems += 0.10;
        mining += 0.05;
        fishing += 0.05;
    }

    // Buffs (si se tienen en inventario, aplican como pasivos por ahora)
    if (owned.has('buffs/trebol-de-fortuna')) bestItems += 0.03;
    if (owned.has('buffs/pez-lumina')) fishing += 0.08;
    if (owned.has('buffs/gusano-brillo')) fishing += 0.06;
    if (owned.has('buffs/scroll-de-impulso-moxi')) mining += 0.06;

    return {
        bestItems: clampPct(bestItems),
        mining: clampPct(mining),
        fishing: clampPct(fishing),
        server: clampPct(server),
    };
}

function buildBuffsContainer({ lang, userId, activeLines, bonusLines, disabled = false } = {}) {
    const language = lang || 'es-ES';
    const safeUserId = normalizeDiscordId(userId) || '0';

    const title = 'Potenciadores Activos ✨';
    const subtitle = 'Bonos de Botín 🍀';

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents((c) => c.setContent(`# ${title}`))
        .addSeparatorComponents((s) => s.setDivider(true))
        .addTextDisplayComponents((c) => c.setContent(activeLines.join('\n')))
        .addSeparatorComponents((s) => s.setDivider(true))
        .addTextDisplayComponents((c) => c.setContent(`## ${subtitle}\n${bonusLines.join('\n')}`))
        .addActionRowComponents((row) =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`buffs:refresh:${safeUserId}`)
                    .setLabel(moxi.translate('REFRESH', language) || 'Refrescar')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(EMOJIS.refresh || '🔁')
                    .setDisabled(disabled)
            )
        );

    return container;
}

async function buildBuffsMessage({ guildId, lang, userId, disabled = false } = {}) {
    const language = lang || (await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES'));
    const safeUserId = normalizeDiscordId(userId) || '';
    if (!safeUserId) {
        return {
            content: '',
            components: [buildBuffsContainer({
                lang: language,
                userId: '0',
                activeLines: ['No hay potenciadores activos ahora.'],
                bonusLines: [
                    `🍀 **Mejores ítems:** ${formatPct(0)}`,
                    `⛏️ **Minería:** ${formatPct(0)}`,
                    `🎣 **Pesca:** ${formatPct(0)}`,
                    `🏠 **Servidor:** ${formatPct(0)}`,
                ],
                disabled: true,
            })],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        };
    }

    const eco = await getOrCreateEconomy(safeUserId).catch(() => null);
    const inv = eco?.inventory || [];

    const bonuses = computeLootBonusesFromInventory(inv);

    const activeLines = ['No hay potenciadores activos ahora.'];

    const bonusLines = [
        `🍀 **Mejores ítems:** ${formatPct(bonuses.bestItems)}`,
        `⛏️ **Minería:** ${formatPct(bonuses.mining)}`,
        `🎣 **Pesca:** ${formatPct(bonuses.fishing)}`,
        `🏠 **Servidor:** ${formatPct(bonuses.server)}`,
    ];

    const container = buildBuffsContainer({
        lang: language,
        userId: safeUserId,
        activeLines,
        bonusLines,
        disabled,
    });

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

module.exports = {
    parseBuffsCustomId,
    buildBuffsMessage,
};
