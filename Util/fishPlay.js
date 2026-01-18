const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const { Bot } = require('../Config');
const moxi = require('../i18n');
const { EMOJIS } = require('./emojis');
const { getItemById } = require('./inventoryCatalog');
const { awardBalance, formatDuration, getOrCreateEconomy } = require('./economyCore');
const { claimRateLimit } = require('./actionRateLimit');
const { addManyToInventory } = require('./inventoryOps');
const { rollFishMaterials } = require('./fishLoot');
const { listFishActivities } = require('./fishActivities');
const { getZonesForKind } = require('./zonesView');
const { hasInventoryItem } = require('./fishView');
const { scaleRange, randInt, chance } = require('./activityUtils');
const { buildNoticeContainer } = require('./v2Notice');

// Anti-spam: no hay cooldown fijo por ejecución; solo se bloquea si se spamea.
const FISH_WINDOW_MS = 30 * 1000;
const FISH_MAX_HITS = 4;
const BASE_FAIL_CHANCE = 0.22;

function trFish(lang, key, vars) {
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
    return moxi.translate(`economy/fish:${key}`, safeLang, vars);
}

function pickNUnique(arr, n) {
    const src = Array.isArray(arr) ? [...arr] : [];
    const out = [];
    while (src.length && out.length < n) {
        const idx = Math.floor(Math.random() * src.length);
        out.push(src.splice(idx, 1)[0]);
    }
    return out;
}

function pickFishScene(lang) {
    const roll = Math.random();
    if (roll < 0.50) {
        const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
        const methods = pickNUnique(listFishActivities(), 3).map(m => ({
            ...m,
            name: m?.nameKey ? trFish(safeLang, String(m.nameKey)) : (m?.name || m?.id),
        }));
        return {
            kind: 'methods',
            emoji: '🎣',
            title: trFish(safeLang, 'PLAY_SCENE_METHODS_TITLE'),
            prompt: trFish(safeLang, 'PLAY_SCENE_METHODS_PROMPT'),
            methods,
        };
    }

    if (roll < 0.75) {
        const seed = randInt(0, 2);
        const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
        return {
            kind: 'doors',
            emoji: '🧰',
            title: trFish(safeLang, 'PLAY_SCENE_DOORS_TITLE'),
            prompt: trFish(safeLang, 'PLAY_SCENE_DOORS_PROMPT'),
            seed,
            doors: [
                { id: 'a', emoji: '🅰️', label: trFish(safeLang, 'PLAY_DOOR_A') },
                { id: 'b', emoji: '🅱️', label: trFish(safeLang, 'PLAY_DOOR_B') },
                { id: 'c', emoji: '🆑', label: trFish(safeLang, 'PLAY_DOOR_C') },
            ],
        };
    }

    const seed = randInt(0, 3);
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
    return {
        kind: 'wires',
        emoji: '🪝',
        title: trFish(safeLang, 'PLAY_SCENE_WIRES_TITLE'),
        prompt: trFish(safeLang, 'PLAY_SCENE_WIRES_PROMPT'),
        seed,
        wires: [
            { id: 'red', emoji: '🔴', label: trFish(safeLang, 'PLAY_WIRE_RED') },
            { id: 'blue', emoji: '🔵', label: trFish(safeLang, 'PLAY_WIRE_BLUE') },
            { id: 'yellow', emoji: '🟡', label: trFish(safeLang, 'PLAY_WIRE_YELLOW') },
            { id: 'green', emoji: '🟢', label: trFish(safeLang, 'PLAY_WIRE_GREEN') },
        ],
    };
}

function getZoneById(kind, zoneId) {
    const zones = getZonesForKind(kind);
    const key = String(zoneId || '').trim().toLowerCase();
    return zones.find(z => String(z?.id || '').trim().toLowerCase() === key) || null;
}

function buildFishPlayMessageOptions({ userId, zoneId, scene, disabled = false, lang } = {}) {
    const zone = getZoneById('fish', zoneId);
    const safeUserId = String(userId || '').trim();
    const zId = String(zone?.id || zoneId || '').trim();
    const safeLang = lang || process.env.DEFAULT_LANG || 'es-ES';
    const sc = scene || pickFishScene(safeLang);

    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
    container.addTextDisplayComponents(c => c.setContent(`## ${sc.emoji || '🎣'} ${trFish(safeLang, 'PLAY_PANEL_HEADER')} • ${zone?.name || zId || trFish(safeLang, 'ZONE_FALLBACK')}`));
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c => c.setContent([`**${sc.title || 'Pesca'}**`, sc.prompt || '¿Qué haces?'].join('\n')));

    if (sc.kind === 'methods') {
        const row = (sc.methods || []).slice(0, 3).map(m =>
            new ButtonBuilder()
                .setCustomId(`fish:do:${safeUserId}:${zId}:m:${String(m.id)}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎣')
                .setLabel(String(m.name || m.id))
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    if (sc.kind === 'doors') {
        const seed = Number.isFinite(sc.seed) ? sc.seed : randInt(0, 2);
        const row = (sc.doors || []).slice(0, 3).map((d, idx) =>
            new ButtonBuilder()
                .setCustomId(`fish:do:${safeUserId}:${zId}:d:${String(d.id)}:${seed}`)
                .setStyle(idx === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji(d.emoji || '🧰')
                .setLabel(String(d.label || d.id))
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    if (sc.kind === 'wires') {
        const seed = Number.isFinite(sc.seed) ? sc.seed : randInt(0, 3);
        const row = (sc.wires || []).slice(0, 4).map(w =>
            new ButtonBuilder()
                .setCustomId(`fish:do:${safeUserId}:${zId}:w:${String(w.id)}:${seed}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(w.emoji || '🪝')
                .setLabel(String(w.label || w.id))
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    container.addActionRowComponents(r => r.addComponents(
        new ButtonBuilder()
            .setCustomId(`fish:play:${safeUserId}:${zId}`)
            .setEmoji(EMOJIS.refresh || '🔄')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`fish:closeplay:${safeUserId}:${zId}`)
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

function parseFishPlayCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('fish:')) return null;
    const parts = raw.split(':');
    const action = parts[1];
    const userId = parts[2];
    if (!action || !userId) return null;
    return { action, userId, parts };
}

function methodSuccessChance(multiplier) {
    const m = Number(multiplier);
    // 1.15 => más riesgo; 0.9 => más seguro
    const base = 1 - BASE_FAIL_CHANCE; // 0.78
    if (!Number.isFinite(m)) return base;
    const adjusted = base - (m - 1) * 0.35;
    return Math.max(0.55, Math.min(0.88, adjusted));
}

async function resolveFishPlay({ userId, zoneId, mode, choiceId, seed, lang } = {}) {
    const zone = getZoneById('fish', zoneId);
    if (!zone) return { ok: false, message: trFish(lang, 'INVALID_ZONE') };

    const eco = await getOrCreateEconomy(userId);
    if (!hasInventoryItem(eco, zone.requiredItemId)) {
        const required = getItemById(zone.requiredItemId, { lang });
        const requiredName = required?.name || String(zone.requiredItemId).split('/').pop() || zone.requiredItemId;
        return {
            ok: false,
            reason: 'requirement',
            message: trFish(lang, 'PLAY_REQUIREMENT_MESSAGE', { zone: zone.name, item: requiredName }),
        };
    }

    const cd = claimRateLimit({ userId, key: 'fish', windowMs: FISH_WINDOW_MS, maxHits: FISH_MAX_HITS });
    if (!cd.ok) return cd;

    const minAmount = Math.max(1, Math.trunc(Number(zone?.reward?.min) || 25));
    const maxAmount = Math.max(minAmount, Math.trunc(Number(zone?.reward?.max) || 60));

    let success = false;
    let actionLine = trFish(lang, 'DEFAULT_ACTION');
    let multiplier = 1;

    if (mode === 'm') {
        const method = listFishActivities().find(a => String(a.id) === String(choiceId)) || null;
        multiplier = method?.multiplier || 1;
        actionLine = method?.phraseKey ? trFish(lang, String(method.phraseKey)) : (method?.phrase || actionLine);
        success = chance(methodSuccessChance(multiplier));
    } else if (mode === 'd') {
        const s = Number.parseInt(seed, 10);
        const goodIdx = Number.isFinite(s) ? Math.max(0, Math.min(2, s)) : 0;
        const good = ['a', 'b', 'c'][goodIdx];
        actionLine = trFish(lang, 'PLAY_ACTION_BOXES');
        multiplier = 1.05;
        success = String(choiceId) === String(good);
    } else if (mode === 'w') {
        const s = Number.parseInt(seed, 10);
        const goodIdx = Number.isFinite(s) ? Math.max(0, Math.min(3, s)) : 0;
        const good = ['red', 'blue', 'yellow', 'green'][goodIdx];
        actionLine = trFish(lang, 'PLAY_ACTION_HOOK');
        multiplier = 1.1;
        success = String(choiceId) === String(good);
    } else {
        // fallback seguro
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

    const scaled = scaleRange(minAmount, maxAmount, multiplier);
    const amount = randInt(scaled.min, scaled.max);
    const res = await awardBalance({ userId, amount });
    if (!res.ok) return { ...res, zone, actionLine, failed: false };

    // Drops (solo si éxito)
    const activity = mode === 'm'
        ? (listFishActivities().find(a => String(a.id) === String(choiceId)) || null)
        : { id: String(mode || 'fish'), multiplier };

    const drops = rollFishMaterials(zone, activity);
    if (drops.length) {
        const ecoAfter = await getOrCreateEconomy(userId);
        addManyToInventory(ecoAfter, drops);
        await ecoAfter.save();
    }

    return { ...res, zone, actionLine, failed: false, drops };
}

function buildFishResultPayload({ zone, res, lang } = {}) {
    const emoji = zone?.emoji || '🎣';
    const t = (k, vars) => trFish(lang, k, vars);
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
            components: [buildNoticeContainer({ emoji, title: `${t('PLAY_PANEL_HEADER')} • ${zone?.name || t('ZONE_FALLBACK')}`, text: t('FAIL_TEXT', { action: res.actionLine }) })],
            flags: MessageFlags.IsComponentsV2,
        };
    }

    const balanceLine = Number.isFinite(res?.balance) ? t('BALANCE_LINE', { balance: res.balance }) : '';

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
                title: `${t('PLAY_PANEL_HEADER')} • ${zone?.name || t('ZONE_FALLBACK')}`,
                text: [
                    t('SUCCESS_TEXT', { action: res.actionLine, amount: res.amount }),
                    balanceLine,
                    materialLines ? `\n${t('MATERIALS_HEADER')}\n${materialLines}` : '',
                ].filter(Boolean).join('\n'),
            }),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

module.exports = {
    pickFishScene,
    buildFishPlayMessageOptions,
    parseFishPlayCustomId,
    resolveFishPlay,
    buildFishResultPayload,
};
