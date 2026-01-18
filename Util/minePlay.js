const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { getItemById } = require('./inventoryCatalog');
const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('./economyCore');
const { addManyToInventory } = require('./inventoryOps');
const { rollMineMaterials } = require('./mineLoot');
const { pickMineActivity } = require('./mineActivities');
const { getZonesForKind } = require('./zonesView');
const { hasInventoryItem } = require('./fishView');
const { scaleRange, randInt, chance } = require('./activityUtils');
const { buildNoticeContainer } = require('./v2Notice');

const MINE_COOLDOWN_MS = 180 * 1000;
const BASE_FAIL_CHANCE = 0.18;

function getZoneById(kind, zoneId) {
    const zones = getZonesForKind(kind);
    const key = String(zoneId || '').trim().toLowerCase();
    return zones.find(z => String(z?.id || '').trim().toLowerCase() === key) || null;
}

function pickMineScene(zone) {
    const requiredId = String(zone?.requiredItemId || '');
    const isExplosive = requiredId.includes('dinamita');

    const roll = Math.random();
    if (roll < 0.55) {
        const methods = isExplosive
            ? [
                { id: 'dinamita', name: 'Dinamita', emoji: '🧨', multiplier: 1.25 },
                { id: 'palanca', name: 'Palanca', emoji: '🧰', multiplier: 1.05 },
                { id: 'sigilo', name: 'Sigilo', emoji: '🕶️', multiplier: 0.95 },
            ]
            : [
                { id: 'pico', name: 'Pico', emoji: '⛏️', multiplier: 1.0 },
                { id: 'precision', name: 'Precisión', emoji: '🎯', multiplier: 1.15 },
                { id: 'rapido', name: 'Rápido', emoji: '⚡', multiplier: 1.05 },
            ];
        return {
            kind: 'methods',
            emoji: zone?.emoji || '⛏️',
            title: 'Minería',
            prompt: 'Elige tu método.',
            methods,
        };
    }

    if (roll < 0.78) {
        const seed = randInt(0, 2);
        return {
            kind: 'doors',
            emoji: '🕳️',
            title: 'Túneles',
            prompt: 'Tres túneles. Uno está lleno de vetas buenas. ¿Cuál tomas?',
            seed,
            doors: [
                { id: 'a', emoji: '🅰️', label: 'Túnel A' },
                { id: 'b', emoji: '🅱️', label: 'Túnel B' },
                { id: 'c', emoji: '🆑', label: 'Túnel C' },
            ],
        };
    }

    const seed = randInt(0, 3);
    return {
        kind: 'wires',
        emoji: '🧨',
        title: 'Detonador',
        prompt: 'Tienes un detonador con 4 cables. Uno es el correcto. ¿Cuál cortas?',
        seed,
        wires: [
            { id: 'red', emoji: '🔴', label: 'Rojo' },
            { id: 'blue', emoji: '🔵', label: 'Azul' },
            { id: 'yellow', emoji: '🟡', label: 'Amarillo' },
            { id: 'green', emoji: '🟢', label: 'Verde' },
        ],
    };
}

function buildMinePlayMessageOptions({ userId, zoneId, scene, disabled = false } = {}) {
    const zone = getZoneById('mine', zoneId);
    const safeUserId = String(userId || '').trim();
    const zId = String(zone?.id || zoneId || '').trim();
    const sc = scene || pickMineScene(zone || {});

    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
    container.addTextDisplayComponents(c => c.setContent(`## ${sc.emoji || '⛏️'} Mine • ${zone?.name || zId || 'Zona'}`));
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c => c.setContent([`**${sc.title || 'Minería'}**`, sc.prompt || '¿Qué haces?'].join('\n')));

    if (sc.kind === 'methods') {
        const row = (sc.methods || []).slice(0, 3).map(m =>
            new ButtonBuilder()
                .setCustomId(`mine:do:${safeUserId}:${zId}:m:${String(m.id)}:${String(m.multiplier)}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(m.emoji || '⛏️')
                .setLabel(String(m.name || m.id))
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    if (sc.kind === 'doors') {
        const seed = Number.isFinite(sc.seed) ? sc.seed : randInt(0, 2);
        const row = (sc.doors || []).slice(0, 3).map((d, idx) =>
            new ButtonBuilder()
                .setCustomId(`mine:do:${safeUserId}:${zId}:d:${String(d.id)}:${seed}`)
                .setStyle(idx === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji(d.emoji || '🕳️')
                .setLabel(String(d.label || d.id))
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    if (sc.kind === 'wires') {
        const seed = Number.isFinite(sc.seed) ? sc.seed : randInt(0, 3);
        const row = (sc.wires || []).slice(0, 4).map(w =>
            new ButtonBuilder()
                .setCustomId(`mine:do:${safeUserId}:${zId}:w:${String(w.id)}:${seed}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(w.emoji || '🧨')
                .setLabel(String(w.label || w.id))
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    container.addActionRowComponents(r => r.addComponents(
        new ButtonBuilder()
            .setCustomId(`mine:play:${safeUserId}:${zId}`)
            .setEmoji(EMOJIS.refresh || '🔄')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`mine:closeplay:${safeUserId}:${zId}`)
            .setEmoji(EMOJIS.stopSign || '⛔')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    ));

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function parseMinePlayCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('mine:')) return null;
    const parts = raw.split(':');
    const action = parts[1];
    const userId = parts[2];
    if (!action || !userId) return null;
    return { action, userId, parts };
}

function methodSuccessChance(multiplier) {
    const m = Number(multiplier);
    const base = 1 - BASE_FAIL_CHANCE; // 0.82
    if (!Number.isFinite(m)) return base;
    const adjusted = base - (m - 1) * 0.45;
    return Math.max(0.50, Math.min(0.90, adjusted));
}

async function resolveMinePlay({ userId, zoneId, mode, choiceId, seedOrMult, lang } = {}) {
    const zone = getZoneById('mine', zoneId);
    if (!zone) return { ok: false, message: 'Zona inválida.' };

    const eco = await getOrCreateEconomy(userId);
    if (!hasInventoryItem(eco, zone.requiredItemId)) {
        const required = getItemById(zone.requiredItemId, { lang });
        const requiredName = required?.name || String(zone.requiredItemId).split('/').pop() || zone.requiredItemId;
        return {
            ok: false,
            reason: 'requirement',
            message: `Para minar en **${zone.name}** necesitas: **${requiredName}**`,
        };
    }

    const cd = await claimCooldown({ userId, field: 'lastMine', cooldownMs: MINE_COOLDOWN_MS });
    if (!cd.ok) return cd;

    const requiredId = String(zone?.requiredItemId || '');
    const isExplosive = requiredId.includes('dinamita');
    const activity = pickMineActivity(zone);
    const baseRange = isExplosive ? { min: 60, max: 140 } : { min: 30, max: 75 };

    let success = false;
    let actionLine = activity?.phrase || 'Has minado';
    let multiplier = activity?.multiplier || 1;

    if (mode === 'm') {
        const extraMult = Number(seedOrMult);
        if (Number.isFinite(extraMult)) multiplier *= extraMult;
        success = chance(methodSuccessChance(multiplier));
    } else if (mode === 'd') {
        const s = Number.parseInt(seedOrMult, 10);
        const goodIdx = Number.isFinite(s) ? Math.max(0, Math.min(2, s)) : 0;
        const good = ['a', 'b', 'c'][goodIdx];
        multiplier *= 1.1;
        actionLine = 'Has tomado un túnel';
        success = String(choiceId) === String(good);
    } else if (mode === 'w') {
        const s = Number.parseInt(seedOrMult, 10);
        const goodIdx = Number.isFinite(s) ? Math.max(0, Math.min(3, s)) : 0;
        const good = ['red', 'blue', 'yellow', 'green'][goodIdx];
        multiplier *= 1.2;
        actionLine = 'Has ajustado el detonador';
        success = String(choiceId) === String(good);
    } else {
        success = !chance(BASE_FAIL_CHANCE);
    }

    if (!success) {
        return {
            ok: true,
            failed: true,
            zone,
            actionLine,
        };
    }

    const scaled = scaleRange(baseRange.min, baseRange.max, multiplier);
    const amount = randInt(scaled.min, scaled.max);
    const res = await awardBalance({ userId, amount });
    if (!res.ok) return { ...res, zone, actionLine };

    // Drops (solo si éxito)
    const drops = rollMineMaterials(zone, activity);
    if (drops.length) {
        const ecoAfter = await getOrCreateEconomy(userId);
        addManyToInventory(ecoAfter, drops);
        await ecoAfter.save();
    }

    return { ...res, zone, actionLine, failed: false, drops };
}

function buildMineResultPayload({ zone, res, lang } = {}) {
    const emoji = zone?.emoji || '⛏️';

    if (!res?.ok && res?.reason === 'cooldown') {
        return {
            content: '',
            components: [buildNoticeContainer({ emoji: '⏳', title: 'Mine • Cooldown', text: `Vuelve en **${formatDuration(res.nextInMs)}**.` })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
    }

    if (!res?.ok) {
        return {
            content: '',
            components: [buildNoticeContainer({ emoji: '⚠️', title: 'Mine', text: res.message || 'No pude procesar tu minería ahora mismo.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
    }

    if (res.failed) {
        return {
            content: '',
            components: [buildNoticeContainer({ emoji, title: `Mine • ${zone?.name || 'Zona'}`, text: `${res.actionLine}... pero hoy no has encontrado nada útil.` })],
            flags: MessageFlags.IsComponentsV2,
        };
    }

    const coin = EMOJIS.coin || '🪙';
    const balanceLine = Number.isFinite(res?.balance) ? `Saldo: **${res.balance}** ${coin}` : '';

    const materialLines = (Array.isArray(res?.drops) ? res.drops : [])
        .map(d => {
            const it = getItemById(d.itemId, { lang });
            const name = it?.name || d.itemId;
            return `+${d.amount} ${name}`;
        })
        .join('\n');

    return {
        content: '',
        components: [
            buildNoticeContainer({
                emoji,
                title: `Mine • ${zone?.name || 'Zona'}`,
                text: [
                    `${res.actionLine} y ganaste **${res.amount}** ${coin}. ¡Buen golpe! ⛏️`,
                    balanceLine,
                    materialLines ? `\nMateriales:\n${materialLines}` : '',
                ].filter(Boolean).join('\n'),
            }),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

module.exports = {
    buildMinePlayMessageOptions,
    parseMinePlayCustomId,
    resolveMinePlay,
    buildMineResultPayload,
};
