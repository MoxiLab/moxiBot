const { ContainerBuilder, DangerButtonBuilder, MessageFlags, PrimaryButtonBuilder, SecondaryButtonBuilder } = require('discord.js');

const { Bot } = require('../Config');
const moxi = require('../i18n');
const { EMOJIS, toEmojiObject } = require('./emojis');
const { getItemById } = require('./inventoryCatalog');
const { awardBalance, formatDuration, getOrCreateEconomy } = require('./economyCore');
const { claimRateLimit } = require('./actionRateLimit');
const { addManyToInventory } = require('./inventoryOps');
const { rollMineMaterials } = require('./mineLoot');
const { pickMineActivity } = require('./mineActivities');
const { getZonesForKind, zoneName } = require('./zonesView');
const { hasInventoryItem } = require('./fishView');
const { scaleRange, randInt, chance } = require('./activityUtils');
const { buildNoticeContainer } = require('./v2Notice');

// Anti-spam: no hay cooldown fijo por ejecución; solo se bloquea si se spamea.
const MINE_WINDOW_MS = 35 * 1000;
const MINE_MAX_HITS = 3;
const BASE_FAIL_CHANCE = 0.18;

function getZoneById(kind, zoneId) {
    const zones = getZonesForKind(kind);
    const key = String(zoneId || '').trim().toLowerCase();
    return zones.find(z => String(z?.id || '').trim().toLowerCase() === key) || null;
}

function trMine(lang, key, vars) {
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
    return moxi.translate(`economy/mine:${key}`, safeLang, vars);
}

function pickMineScene(zone, lang) {
    const requiredId = String(zone?.requiredItemId || '');
    const isExplosive = requiredId.includes('dinamita');

    const roll = Math.random();
    if (roll < 0.55) {
        const methods = isExplosive
            ? [
                { id: 'dinamita', name: trMine(lang, 'PLAY_METHOD_DYNAMITE'), emoji: '🧨', multiplier: 1.25 },
                { id: 'palanca', name: trMine(lang, 'PLAY_METHOD_LEVER'), emoji: '🧰', multiplier: 1.05 },
                { id: 'sigilo', name: trMine(lang, 'PLAY_METHOD_STEALTH'), emoji: '🕶️', multiplier: 0.95 },
            ]
            : [
                { id: 'pico', name: trMine(lang, 'PLAY_METHOD_PICKAXE'), emoji: '⛏️', multiplier: 1.0 },
                { id: 'precision', name: trMine(lang, 'PLAY_METHOD_PRECISION'), emoji: '🎯', multiplier: 1.15 },
                { id: 'rapido', name: trMine(lang, 'PLAY_METHOD_FAST'), emoji: '⚡', multiplier: 1.05 },
            ];
        return {
            kind: 'methods',
            emoji: zone?.emoji || '⛏️',
            title: trMine(lang, 'PLAY_SCENE_METHODS_TITLE'),
            prompt: trMine(lang, 'PLAY_SCENE_METHODS_PROMPT'),
            methods,
        };
    }

    if (roll < 0.78) {
        const seed = randInt(0, 2);
        return {
            kind: 'doors',
            emoji: '🕳️',
            title: trMine(lang, 'PLAY_SCENE_DOORS_TITLE'),
            prompt: trMine(lang, 'PLAY_SCENE_DOORS_PROMPT'),
            seed,
            doors: [
                { id: 'a', emoji: '🅰️', label: trMine(lang, 'PLAY_DOOR_A') },
                { id: 'b', emoji: '🅱️', label: trMine(lang, 'PLAY_DOOR_B') },
                { id: 'c', emoji: '🆑', label: trMine(lang, 'PLAY_DOOR_C') },
            ],
        };
    }

    const seed = randInt(0, 3);
    return {
        kind: 'wires',
        emoji: '🧨',
        title: trMine(lang, 'PLAY_SCENE_WIRES_TITLE'),
        prompt: trMine(lang, 'PLAY_SCENE_WIRES_PROMPT'),
        seed,
        wires: [
            { id: 'red', emoji: '🔴', label: trMine(lang, 'PLAY_WIRE_RED') },
            { id: 'blue', emoji: '🔵', label: trMine(lang, 'PLAY_WIRE_BLUE') },
            { id: 'yellow', emoji: '🟡', label: trMine(lang, 'PLAY_WIRE_YELLOW') },
            { id: 'green', emoji: '🟢', label: trMine(lang, 'PLAY_WIRE_GREEN') },
        ],
    };
}

function buildMinePlayMessageOptions({ userId, zoneId, scene, disabled = false, lang } = {}) {
    const zone = getZoneById('mine', zoneId);
    const safeUserId = String(userId || '').trim();
    const zId = String(zone?.id || zoneId || '').trim();
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
    const sc = scene || pickMineScene(zone || {}, safeLang);
    const displayZone = zone ? zoneName({ kind: 'mine', zone, lang: safeLang }) : (zId || trMine(safeLang, 'ZONE_FALLBACK'));

    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
    container.addTextDisplayComponents(c => c.setContent(`## ${sc.emoji || '⛏️'} ${trMine(safeLang, 'PLAY_PANEL_HEADER')} • ${displayZone}`));
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c => c.setContent([`**${sc.title || 'Minería'}**`, sc.prompt || '¿Qué haces?'].join('\n')));

    if (sc.kind === 'methods') {
        const row = (sc.methods || []).slice(0, 3).map(m =>
            new SecondaryButtonBuilder()
                .setCustomId(`mine:do:${safeUserId}:${zId}:m:${String(m.id)}:${String(m.multiplier)}`)
                .setEmoji(toEmojiObject(m.emoji || '⛏️'))
                .setLabel(String(m.name || m.id))
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    if (sc.kind === 'doors') {
        const seed = Number.isFinite(sc.seed) ? sc.seed : randInt(0, 2);
        const row = (sc.doors || []).slice(0, 3).map((d, idx) =>
            (idx === 1 ? new PrimaryButtonBuilder() : new SecondaryButtonBuilder())
                .setCustomId(`mine:do:${safeUserId}:${zId}:d:${String(d.id)}:${seed}`)
                .setEmoji(toEmojiObject(d.emoji || '🕳️'))
                .setLabel(String(d.label || d.id))
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    if (sc.kind === 'wires') {
        const seed = Number.isFinite(sc.seed) ? sc.seed : randInt(0, 3);
        const row = (sc.wires || []).slice(0, 4).map(w =>
            new SecondaryButtonBuilder()
                .setCustomId(`mine:do:${safeUserId}:${zId}:w:${String(w.id)}:${seed}`)
                .setEmoji(toEmojiObject(w.emoji || '🧨'))
                .setLabel(String(w.label || w.id))
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    container.addActionRowComponents(r => r.addComponents(
        new SecondaryButtonBuilder()
            .setCustomId(`mine:play:${safeUserId}:${zId}`)
            .setEmoji(toEmojiObject(EMOJIS.refresh || '🔄'))
            .setDisabled(disabled),
        new DangerButtonBuilder()
            .setCustomId(`mine:closeplay:${safeUserId}:${zId}`)
            .setEmoji(toEmojiObject(EMOJIS.stopSign || '⛔'))
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
    if (!zone) return { ok: false, message: trMine(lang, 'INVALID_ZONE') };

    const eco = await getOrCreateEconomy(userId);
    if (!hasInventoryItem(eco, zone.requiredItemId)) {
        const required = getItemById(zone.requiredItemId, { lang });
        const requiredName = required?.name || String(zone.requiredItemId).split('/').pop() || zone.requiredItemId;
        const displayZone = zoneName({ kind: 'mine', zone, lang: lang || process.env.DEFAULT_LANG || 'es-ES' });
        return {
            ok: false,
            reason: 'requirement',
            message: trMine(lang, 'PLAY_REQUIREMENT_MESSAGE', { zone: displayZone, item: requiredName }),
        };
    }

    const cd = claimRateLimit({ userId, key: 'mine', windowMs: MINE_WINDOW_MS, maxHits: MINE_MAX_HITS });
    if (!cd.ok) return cd;

    const requiredId = String(zone?.requiredItemId || '');
    const isExplosive = requiredId.includes('dinamita');
    const activity = pickMineActivity(zone);
    const baseRange = isExplosive ? { min: 60, max: 140 } : { min: 30, max: 75 };

    let success = false;
    let actionLine = activity?.phraseKey ? trMine(lang, String(activity.phraseKey)) : (activity?.phrase || trMine(lang, 'DEFAULT_ACTION'));
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
        actionLine = trMine(lang, 'PLAY_ACTION_TUNNEL');
        success = String(choiceId) === String(good);
    } else if (mode === 'w') {
        const s = Number.parseInt(seedOrMult, 10);
        const goodIdx = Number.isFinite(s) ? Math.max(0, Math.min(3, s)) : 0;
        const good = ['red', 'blue', 'yellow', 'green'][goodIdx];
        multiplier *= 1.2;
        actionLine = trMine(lang, 'PLAY_ACTION_DETONATOR');
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
    const t = (k, vars) => trMine(lang, k, vars);
    const displayZone = zone ? zoneName({ kind: 'mine', zone, lang: lang || process.env.DEFAULT_LANG || 'es-ES' }) : t('ZONE_FALLBACK');

    if (!res?.ok && res?.reason === 'cooldown') {
        return {
            content: '',
            components: [buildNoticeContainer({ emoji: '⏳', title: t('COOLDOWN_TITLE'), text: t('COOLDOWN_TEXT', { time: formatDuration(res.nextInMs) }) })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
    }

    if (!res?.ok) {
        return {
            content: '',
            components: [buildNoticeContainer({ emoji: '⚠️', title: t('ERROR_TITLE'), text: res.message || t('ERROR_GENERIC') })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
    }

    if (res.failed) {
        return {
            content: '',
            components: [buildNoticeContainer({ emoji, title: `${t('PLAY_PANEL_HEADER')} • ${displayZone}`, text: t('FAIL_TEXT', { action: res.actionLine }) })],
            flags: MessageFlags.IsComponentsV2,
        };
    }

    const coin = EMOJIS.coin || '🪙';
    const balanceLine = Number.isFinite(res?.balance) ? t('BALANCE_LINE', { balance: res.balance, coin }) : '';

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
                title: `${t('PLAY_PANEL_HEADER')} • ${displayZone}`,
                text: [
                    t('SUCCESS_TEXT', { action: res.actionLine, amount: res.amount, coin }),
                    balanceLine,
                    materialLines ? `\n${t('MATERIALS_HEADER')}\n${materialLines}` : '',
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
