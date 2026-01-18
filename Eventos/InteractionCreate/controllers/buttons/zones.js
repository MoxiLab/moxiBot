const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { getItemById } = require('../../../../Util/inventoryCatalog');
const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('../../../../Util/economyCore');
const { addManyToInventory } = require('../../../../Util/inventoryOps');
const { rollMineMaterials } = require('../../../../Util/mineLoot');
const { rollFishMaterials } = require('../../../../Util/fishLoot');
const { pickMineActivity } = require('../../../../Util/mineActivities');
const { pickFishActivity } = require('../../../../Util/fishActivities');
const { scaleRange, randInt, chance } = require('../../../../Util/activityUtils');
const {
    parseZonesCustomId,
    buildZonesContainer,
    getZoneForPick,
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
        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: 'Solo el autor puede usar estos botones.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    if (action === 'help') {
        const payload = {
            content: '',
            components: [
                buildNoticeContainer({
                    emoji: EMOJIS.question,
                    title: 'Zonas',
                    text: 'Usa los botones para cambiar de categoría (Pesca / Minería / Exploración).\nPulsa una zona para ejecutar la acción.',
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
                components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: 'Esa zona no existe en esta página.' })],
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

            const titlePrefix = kind === 'fish' ? 'Fish' : (kind === 'mine' ? 'Minería' : 'Exploración');
            const payload = {
                content: '',
                components: [
                    buildNoticeContainer({
                        emoji: EMOJIS.noEntry,
                        title: `${titlePrefix} • Requisito`,
                        text:
                            (kind === 'fish'
                                ? `Para pescar en **${zone.name}** necesitas: **${requiredName}**`
                                : kind === 'mine'
                                    ? `Para minar en **${zone.name}** necesitas: **${requiredName}**`
                                    : `Para explorar **${zone.name}** necesitas: **${requiredName}**`),
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
        const cooldownSec = kind === 'fish' ? 120 : (kind === 'mine' ? 180 : 600);
        const cooldownMs = Math.max(1, safeInt(cooldownSec, 300)) * 1000;

        let res;
        let activity = null;
        if (kind === 'fish') {
            const minAmount = Math.max(1, safeInt(zone?.reward?.min, 25));
            const maxAmount = Math.max(minAmount, safeInt(zone?.reward?.max, 60));
            activity = pickFishActivity();
            const scaled = scaleRange(minAmount, maxAmount, activity?.multiplier || 1);
            const cd = await claimCooldown({ userId, field, cooldownMs });
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
            const cd = await claimCooldown({ userId, field, cooldownMs });
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
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: '⏳', title: 'Zonas • Cooldown', text: `Vuelve en **${formatDuration(res.nextInMs)}**.` })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        if (!res.ok) {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: '⚠️', title: 'Zonas', text: res.message || 'No pude procesar tu acción ahora mismo.' })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        const titlePrefix = kind === 'fish' ? 'Fish' : (kind === 'mine' ? 'Minería' : 'Exploración');
        const actionText = kind === 'fish' ? 'Has pescado' : (kind === 'mine' ? 'Has minado' : 'Has explorado');
        const actionLine = (kind === 'fish' || kind === 'mine') ? (res?.actionLine || activity?.phrase || actionText) : actionText;
        const coin = EMOJIS.coin || '🪙';
        let rewardText = (kind === 'fish' || kind === 'mine') && Number.isFinite(res?.amount)
            ? `\n+ Ganaste **${res.amount}** ${coin}`
            : '';

        if ((kind === 'fish' || kind === 'mine') && Number.isFinite(res?.balance)) {
            rewardText += `\nSaldo: **${res.balance}** ${coin}`;
        }

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
                if (lines) rewardText += `\n\nMateriales:\n${lines}`;
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
                if (lines) rewardText += `\n\nMateriales:\n${lines}`;
            }
        }

        await interaction.followUp({
            content: '',
            components: [
                buildNoticeContainer({
                    emoji: zone.emoji || (kind === 'mine' ? '⛏️' : (kind === 'explore' ? '🧭' : '🎣')),
                    title: `${titlePrefix} • ${zone.name}`,
                    text: kind === 'fish'
                        ? (res?.failed ? `${actionLine}... pero no ha picado nada.` : `${actionLine}. ¡Buen lance! 🎣${rewardText}`)
                        : (kind === 'mine' && res?.failed ? `${actionLine}... pero no has encontrado nada útil.` : `${actionLine}. ¡Hecho!${rewardText}`),
                }),
            ],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);

        return true;
    }

    return false;
};
