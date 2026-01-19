const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { getItemById } = require('../../../../Util/inventoryCatalog');
const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('../../../../Util/economyCore');
const { claimRateLimit } = require('../../../../Util/actionRateLimit');
const { addManyToInventory } = require('../../../../Util/inventoryOps');
const { rollMineMaterials } = require('../../../../Util/mineLoot');
const { rollFishMaterials } = require('../../../../Util/fishLoot');
const { pickMineActivity } = require('../../../../Util/mineActivities');
const { pickFishActivity } = require('../../../../Util/fishActivities');
const { scaleRange, randInt, chance } = require('../../../../Util/activityUtils');
const { shouldShowCooldownNotice } = require('../../../../Util/cooldownNotice');
const {
    parseZonesCustomId,
    buildZonesContainer,
    getZoneForPick,
    zoneName,
} = require('../../../../Util/zonesView');
const { hasInventoryItem } = require('../../../../Util/fishView');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.trunc(x);
}

const FISH_FAIL_CHANCE = 0.22;
const MINE_FAIL_CHANCE = 0.18;

module.exports = async function zonesButtons(interaction) {
    const parsed = parseZonesCustomId(interaction?.customId);
    if (!parsed) return false;

    const { action, userId, kind, page, index } = parsed;

    // Solo el autor puede usar el panel
    if (interaction.user?.id !== String(userId)) {
        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES');
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: moxi.translate('misc:ONLY_AUTHOR_BUTTONS', lang) })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    const fallbackLang = interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES';
    const lang = await moxi.guildLang(guildId, fallbackLang);

    const tZones = (k, vars = {}) => moxi.translate(`economy/zones:${k}`, lang, vars);
    const tFish = (k, vars = {}) => moxi.translate(`economy/fish:${k}`, lang, vars);
    const tMine = (k, vars = {}) => moxi.translate(`economy/mine:${k}`, lang, vars);

    if (action === 'help') {
        const payload = {
            content: '',
            components: [
                buildNoticeContainer({
                    emoji: EMOJIS.question,
                    title: tZones('ui.selectCategory') || 'Zones',
                    text: [
                        tZones('ui.pickHintFish') || 'Press a zone button to fish.',
                        tZones('ui.pickHintOther') || 'Press a zone to perform the action.',
                    ].join('\n'),
                }),
            ],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    if (action === 'close') {
        const built = buildZonesContainer({ lang, userId, kind, page: Number(page) || 0, disabledButtons: true });
        await interaction.update({ content: '', components: [built.container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
        return true;
    }

    if (action === 'select') {
        const selected = String(interaction.values?.[0] || '').trim();
        const built = buildZonesContainer({ lang, userId, kind: selected || kind, page: 0 });
        await interaction.update({ content: '', components: [built.container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
        return true;
    }

    if (action === 'prev' || action === 'next' || action === 'refresh') {
        let nextPage = Number(page) || 0;
        if (action === 'prev') nextPage -= 1;
        if (action === 'next') nextPage += 1;
        const built = buildZonesContainer({ lang, userId, kind, page: nextPage });
        await interaction.update({ content: '', components: [built.container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
        return true;
    }

    if (action === 'pick') {
        const zone = getZoneForPick({ kind, page: Number(page) || 0, index: Number(index) || 0 });
        if (!zone) {
            const payload = {
                content: '',
                components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: (kind === 'fish' ? tFish('PANEL_ZONE_NOT_FOUND_TEXT') : (kind === 'mine' ? tMine('INVALID_ZONE') : 'Invalid zone.')) })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            };
            if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
            else await interaction.reply(payload).catch(() => null);
            return true;
        }

        const eco = await getOrCreateEconomy(userId);
        if (!hasInventoryItem(eco, zone.requiredItemId)) {
            const required = getItemById(zone.requiredItemId, { lang });
            const requiredName = required?.name || String(zone.requiredItemId).split('/').pop() || zone.requiredItemId;

            const displayZone = zoneName({ kind, zone, lang }) || zone.name;

            const titlePrefix = kind === 'fish'
                ? (tFish('PLAY_PANEL_HEADER') || 'Fish')
                : (kind === 'mine'
                    ? (tMine('PLAY_PANEL_HEADER') || 'Mine')
                    : (tZones(`kinds.${kind}`) || 'Exploration'));
            const payload = {
                content: '',
                components: [
                    buildNoticeContainer({
                        emoji: EMOJIS.noEntry,
                        title: kind === 'fish'
                            ? (tFish('REQUIREMENT_TITLE') || `${titlePrefix} • Requirement`)
                            : (kind === 'mine'
                                ? (tMine('REQUIREMENT_TITLE') || `${titlePrefix} • Requirement`)
                                : `${titlePrefix} • Requirement`),
                        text: kind === 'fish'
                            ? (tFish('PLAY_REQUIREMENT_MESSAGE', { zone: displayZone, item: requiredName }) || `To fish in **${displayZone}** you need: **${requiredName}**`)
                            : (kind === 'mine'
                                ? (tMine('PLAY_REQUIREMENT_MESSAGE', { zone: displayZone, item: requiredName }) || `To mine in **${displayZone}** you need: **${requiredName}**`)
                                : `To explore **${displayZone}** you need: **${requiredName}**`),
                    }),
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            };
            if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
            else await interaction.reply(payload).catch(() => null);
            return true;
        }

        // Mantener el panel (deferUpdate) y enviar el resultado en ephemeral
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => null);
        }

        const field = kind === 'fish' ? 'lastFish' : (kind === 'mine' ? 'lastMine' : 'lastExplore');
        const cooldownSec = kind === 'fish' ? 30 : (kind === 'mine' ? 35 : 600);
        const cooldownMs = Math.max(1, safeInt(cooldownSec, 300)) * 1000;

        let res;
        let activity = null;
        if (kind === 'fish') {
            const minAmount = Math.max(1, safeInt(zone?.reward?.min, 25));
            const maxAmount = Math.max(minAmount, safeInt(zone?.reward?.max, 60));
            activity = pickFishActivity();
            const scaled = scaleRange(minAmount, maxAmount, activity?.multiplier || 1);
            const cd = claimRateLimit({ userId, key: 'fish', windowMs: 30 * 1000, maxHits: 4 });
            if (!cd.ok) res = cd;
            else {
                const actionLine = activity?.phrase || 'Has pescado';
                if (chance(FISH_FAIL_CHANCE)) {
                    res = { ok: true, failed: true, actionLine };
                } else {
                    const amount = randInt(scaled.min, scaled.max);
                    res = await awardBalance({ userId, amount });
                    res.actionLine = actionLine;
                }
            }
        } else if (kind === 'mine') {
            const requiredId = String(zone?.requiredItemId || '');
            const isExplosive = requiredId.includes('dinamita');
            activity = pickMineActivity(zone);
            const base = isExplosive ? { min: 60, max: 140 } : { min: 30, max: 75 };
            const scaled = scaleRange(base.min, base.max, activity?.multiplier || 1);
            const cd = claimRateLimit({ userId, key: 'mine', windowMs: 35 * 1000, maxHits: 3 });
            if (!cd.ok) res = cd;
            else {
                const actionLine = activity?.phrase || 'Has minado';
                if (chance(MINE_FAIL_CHANCE)) {
                    res = { ok: true, failed: true, actionLine };
                } else {
                    const amount = randInt(scaled.min, scaled.max);
                    res = await awardBalance({ userId, amount });
                    res.actionLine = actionLine;
                }
            }
        } else {
            res = await claimCooldown({ userId, field, cooldownMs });
        }

        if (!res.ok && res.reason === 'cooldown') {
            if (!shouldShowCooldownNotice({ userId, key: `zones:${kind}` })) {
                return true;
            }
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({
                    emoji: '⏳',
                    title: kind === 'fish' ? (tFish('COOLDOWN_TITLE') || 'Fish • Cooldown') : (kind === 'mine' ? (tMine('COOLDOWN_TITLE') || 'Mine • Cooldown') : 'Zones • Cooldown'),
                    text: kind === 'fish'
                        ? (tFish('COOLDOWN_TEXT', { time: formatDuration(res.nextInMs) }) || `Come back in **${formatDuration(res.nextInMs)}**.`)
                        : (kind === 'mine'
                            ? (tMine('COOLDOWN_TEXT', { time: formatDuration(res.nextInMs) }) || `Come back in **${formatDuration(res.nextInMs)}**.`)
                            : `Come back in **${formatDuration(res.nextInMs)}**.`),
                })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        if (!res.ok) {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({
                    emoji: '⚠️',
                    title: kind === 'fish' ? (tFish('ERROR_TITLE') || 'Fish') : (kind === 'mine' ? (tMine('ERROR_TITLE') || 'Mine') : 'Zones'),
                    text: res.message || (kind === 'fish' ? (tFish('ERROR_GENERIC') || 'I could not process that right now.') : (kind === 'mine' ? (tMine('ERROR_GENERIC') || 'I could not process that right now.') : 'I could not process that right now.')),
                })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        const displayZone = zoneName({ kind, zone, lang }) || zone.name;
        const titlePrefix = kind === 'fish'
            ? (tFish('PLAY_PANEL_HEADER') || 'Fish')
            : (kind === 'mine'
                ? (tMine('PLAY_PANEL_HEADER') || 'Mine')
                : (tZones(`kinds.${kind}`) || 'Exploration'));
        const defaultActionText = kind === 'fish'
            ? (tFish('DEFAULT_ACTION') || 'You fished')
            : (kind === 'mine'
                ? (tMine('DEFAULT_ACTION') || 'You mined')
                : 'You explored');
        const actionLine = (kind === 'fish' || kind === 'mine')
            ? (res?.actionLine || activity?.phrase || defaultActionText)
            : defaultActionText;
        const coin = EMOJIS.coin || '🪙';

        let materialsLines = '';

        // Materiales extra por minería
        if (kind === 'mine' && res?.ok && !res?.failed) {
            const drops = rollMineMaterials(zone, activity);
            if (drops.length) {
                const ecoAfter = await getOrCreateEconomy(userId);
                addManyToInventory(ecoAfter, drops);
                await ecoAfter.save();

                const lines = drops
                    .map(d => {
                        const it = getItemById(d.itemId, { lang });
                        const name = it?.name || d.itemId;
                        return `+${d.amount} ${name}`;
                    })
                    .join('\n');
                if (lines) materialsLines = lines;
            }
        }

        // Materiales extra por pesca
        if (kind === 'fish' && res?.ok && !res?.failed) {
            const drops = rollFishMaterials(zone, activity);
            if (drops.length) {
                const ecoAfter = await getOrCreateEconomy(userId);
                addManyToInventory(ecoAfter, drops);
                await ecoAfter.save();

                const lines = drops
                    .map(d => {
                        const it = getItemById(d.itemId, { lang });
                        const name = it?.name || d.itemId;
                        return `+${d.amount} ${name}`;
                    })
                    .join('\n');
                if (lines) materialsLines = lines;
            }
        }

        let text = '';
        if (kind === 'fish') {
            if (res?.failed) {
                text = tFish('FAIL_TEXT', { action: actionLine }) || `${actionLine}... but nothing bit.`;
            } else {
                const successLine = Number.isFinite(res?.amount)
                    ? (tFish('SUCCESS_TEXT', { action: actionLine, amount: res.amount }) || `${actionLine} and you earned **${res.amount}** 🪙.`)
                    : actionLine;
                const balanceLine = Number.isFinite(res?.balance)
                    ? (tFish('BALANCE_LINE', { balance: res.balance }) || '')
                    : '';
                const matsHeader = tFish('MATERIALS_HEADER') || 'Materials:';
                const matsBlock = materialsLines ? `\n\n${matsHeader}\n${materialsLines}` : '';
                text = [successLine, balanceLine].filter(Boolean).join('\n') + matsBlock;
            }
        } else if (kind === 'mine') {
            if (res?.failed) {
                text = tMine('FAIL_TEXT', { action: actionLine }) || `${actionLine}... but you found nothing useful.`;
            } else {
                const successLine = Number.isFinite(res?.amount)
                    ? (tMine('SUCCESS_TEXT', { action: actionLine, amount: res.amount, coin }) || `${actionLine} and you earned **${res.amount}** ${coin}.`)
                    : actionLine;
                const balanceLine = Number.isFinite(res?.balance)
                    ? (tMine('BALANCE_LINE', { balance: res.balance, coin }) || '')
                    : '';
                const matsHeader = tMine('MATERIALS_HEADER') || 'Materials:';
                const matsBlock = materialsLines ? `\n\n${matsHeader}\n${materialsLines}` : '';
                text = [successLine, balanceLine].filter(Boolean).join('\n') + matsBlock;
            }
        } else {
            // Explore (sin i18n dedicado)
            text = res?.failed ? `${actionLine}...` : `${actionLine}.`;
        }

        await interaction.followUp({
            content: '',
            components: [
                buildNoticeContainer({
                    emoji: zone.emoji || (kind === 'mine' ? '⛏️' : (kind === 'explore' ? '🧭' : '🎣')),
                    title: `${titlePrefix} • ${displayZone}`,
                    text,
                }),
            ],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);

        return true;
    }

    return false;
};
