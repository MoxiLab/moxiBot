const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { getItemById } = require('../../../../Util/inventoryCatalog');
const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('../../../../Util/economyCore');
const { addManyToInventory } = require('../../../../Util/inventoryOps');
const { rollFishMaterials } = require('../../../../Util/fishLoot');
const { pickFishActivity } = require('../../../../Util/fishActivities');
const { scaleRange, randInt, chance } = require('../../../../Util/activityUtils');
const {
    parseFishCustomId,
    buildFishZonesContainer,
    getZoneForPick,
    hasInventoryItem,
} = require('../../../../Util/fishView');
const {
    buildFishPlayMessageOptions,
    resolveFishPlay,
    buildFishResultPayload,
} = require('../../../../Util/fishPlay');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.trunc(x);
}

const FISH_FAIL_CHANCE = 0.22;

module.exports = async function fishButtons(interaction) {
    const parsed = parseFishCustomId(interaction?.customId);
    if (!parsed) return false;

    const { action, userId, page, index, parts } = parsed;

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

    // --- Minijuego: fish:play:<userId>:<zoneId>
    if (action === 'play') {
        const zoneId = parts?.[3];
        const payload = buildFishPlayMessageOptions({ userId, zoneId });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    // --- Minijuego: fish:closeplay:<userId>:<zoneId>
    if (action === 'closeplay') {
        const zoneId = parts?.[3];
        const payload = buildFishPlayMessageOptions({ userId, zoneId, disabled: true });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    // --- Minijuego: fish:do:<userId>:<zoneId>:<mode>:<choice>[:seed]
    if (action === 'do') {
        const zoneId = parts?.[3];
        const mode = parts?.[4];
        const choiceId = parts?.[5];
        const seed = parts?.[6];

        // deferUpdate y luego edit del mensaje con resultado
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => null);
        }

        const res = await resolveFishPlay({ userId, zoneId, mode, choiceId, seed, lang });
        const zone = res?.zone;

        // Cooldown / errores -> ephemeral
        if (!res?.ok || res?.reason === 'cooldown' || res?.reason === 'requirement') {
            const payload = buildFishResultPayload({ zone, res, lang });
            await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => null);
            return true;
        }

        // Resultado público editando el mensaje
        const payload = buildFishResultPayload({ zone, res, lang });
        await interaction.message?.edit?.(payload).catch(() => null);
        return true;
    }

    if (action === 'help') {
        const payload = {
            content: '',
            components: [
                buildNoticeContainer({
                    emoji: EMOJIS.question,
                    title: 'Fish',
                    text: 'Pulsa una zona para pescar.\nNecesitas el ítem requerido en tu inventario.\nEl comando también funciona por texto: **.fish <zona>**',
                }),
            ],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    if (action === 'close') {
        const built = buildFishZonesContainer({ lang, page: Number(page) || 0, userId, disabledButtons: true });
        await interaction.update({ content: '', components: [built.container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
        return true;
    }

    if (action === 'prev' || action === 'next' || action === 'refresh') {
        let nextPage = Number(page) || 0;
        if (action === 'prev') nextPage -= 1;
        if (action === 'next') nextPage += 1;
        const built = buildFishZonesContainer({ lang, page: nextPage, userId });
        await interaction.update({ content: '', components: [built.container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
        return true;
    }

    if (action === 'pick') {
        const zone = getZoneForPick({ page: Number(page) || 0, index: Number(index) || 0 });
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
            const payload = {
                content: '',
                components: [
                    buildNoticeContainer({
                        emoji: EMOJIS.noEntry,
                        title: 'Fish • Requisito',
                        text: `Para pescar en **${zone.name}** necesitas: **${requiredName}**`,
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

        const cooldownMs = Math.max(1, safeInt(120, 120)) * 1000; // default; el comando puede ajustar su cooldown por texto
        const minAmount = Math.max(1, safeInt(zone?.reward?.min, 25));
        const maxAmount = Math.max(minAmount, safeInt(zone?.reward?.max, 60));
        const activity = pickFishActivity();
        const scaled = scaleRange(minAmount, maxAmount, activity?.multiplier || 1);
        const cd = await claimCooldown({
            userId,
            field: 'lastFish',
            cooldownMs,
        });

        if (!cd.ok && cd.reason === 'cooldown') {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: '⏳', title: 'Fish • Cooldown', text: `Vuelve en **${formatDuration(cd.nextInMs)}**.` })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        if (!cd.ok) {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: '⚠️', title: 'Fish', text: cd.message || 'No pude procesar tu pesca ahora mismo.' })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        const actionLine = activity?.phrase || 'Has pescado';

        if (chance(FISH_FAIL_CHANCE)) {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: zone.emoji || '🎣', title: `Fish • ${zone.name}`, text: `${actionLine}... pero no ha picado nada.` })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        const amount = randInt(scaled.min, scaled.max);
        const res = await awardBalance({ userId, amount });
        const balanceLine = Number.isFinite(res?.balance) ? `Saldo: **${res.balance}** 🪙` : '';

        if (!res.ok && res.reason === 'cooldown') {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: '⏳', title: 'Fish • Cooldown', text: `Vuelve en **${formatDuration(res.nextInMs)}**.` })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        if (!res.ok) {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: '⚠️', title: 'Fish', text: res.message || 'No pude procesar tu pesca ahora mismo.' })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        // Drops (solo si éxito)
        const drops = rollFishMaterials(zone, activity);
        if (drops.length) {
            const ecoAfter = await getOrCreateEconomy(userId);
            addManyToInventory(ecoAfter, drops);
            await ecoAfter.save();
        }

        const materialLines = drops
            .map(d => {
                const it = getItemById(d.itemId, { lang });
                const name = it?.name || d.itemId;
                return `+${d.amount} ${name}`;
            })
            .join('\n');

        await interaction.followUp({
            content: '',
            components: [
                buildNoticeContainer({
                    emoji: zone.emoji || '🎣',
                    title: `Fish • ${zone.name}`,
                    text: [
                        `${actionLine} y ganaste **${res.amount}** 🪙. ¡Buen lance! 🎣`,
                        balanceLine,
                        materialLines ? `\nMateriales:\n${materialLines}` : '',
                    ].filter(Boolean).join('\n'),
                }),
            ],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);

        return true;
    }

    return false;
};
