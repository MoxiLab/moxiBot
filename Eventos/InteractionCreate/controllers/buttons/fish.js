const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { getItemById } = require('../../../../Util/inventoryCatalog');
const { awardBalance, formatDuration, getOrCreateEconomy } = require('../../../../Util/economyCore');
const { claimRateLimit } = require('../../../../Util/actionRateLimit');
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
const { shouldShowCooldownNotice } = require('../../../../Util/cooldownNotice');

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
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: moxi.translate('misc:ONLY_AUTHOR_BUTTONS', lang) })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
    const t = (k, vars) => moxi.translate(`economy/fish:${k}`, lang, vars);

    // --- Minijuego: fish:play:<userId>:<zoneId>
    if (action === 'play') {
        const zoneId = parts?.[3];
        const payload = buildFishPlayMessageOptions({ userId, zoneId, lang });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    // --- Minijuego: fish:closeplay:<userId>:<zoneId>
    if (action === 'closeplay') {
        const zoneId = parts?.[3];
        const payload = buildFishPlayMessageOptions({ userId, zoneId, disabled: true, lang });
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
            if (res?.reason === 'cooldown' && !shouldShowCooldownNotice({ userId, key: 'fish' })) {
                return true;
            }
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
                    title: moxi.translate('economy/fish:HELP_TITLE', lang),
                    text: moxi.translate('economy/fish:HELP_TEXT', lang),
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
                components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: t('PANEL_ZONE_NOT_FOUND_TEXT') })],
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
                        title: t('REQUIREMENT_TITLE'),
                        text: t('PLAY_REQUIREMENT_MESSAGE', { zone: zone.name, item: requiredName }),
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

        const cooldownMs = Math.max(1, safeInt(30, 30)) * 1000; // compat: se usa solo para mostrar tiempo
        const minAmount = Math.max(1, safeInt(zone?.reward?.min, 25));
        const maxAmount = Math.max(minAmount, safeInt(zone?.reward?.max, 60));
        const activity = pickFishActivity();
        const scaled = scaleRange(minAmount, maxAmount, activity?.multiplier || 1);
        const cd = claimRateLimit({ userId, key: 'fish', windowMs: 30 * 1000, maxHits: 4 });

        if (!cd.ok && cd.reason === 'cooldown') {
            if (!shouldShowCooldownNotice({ userId, key: 'fish' })) {
                return true;
            }
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: '⏳', title: t('COOLDOWN_TITLE'), text: t('COOLDOWN_TEXT', { time: formatDuration(cd.nextInMs) }) })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        const actionLine = activity?.phraseKey ? t(String(activity.phraseKey)) : (activity?.phrase || t('DEFAULT_ACTION'));

        if (chance(FISH_FAIL_CHANCE)) {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: zone.emoji || '🎣', title: `${t('PLAY_PANEL_HEADER')} • ${zone.name}`, text: t('FAIL_TEXT', { action: actionLine }) })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        const amount = randInt(scaled.min, scaled.max);
        const res = await awardBalance({ userId, amount });
        const balanceLine = Number.isFinite(res?.balance) ? t('BALANCE_LINE', { balance: res.balance }) : '';

        if (!res.ok && res.reason === 'cooldown') {
            if (!shouldShowCooldownNotice({ userId, key: 'fish' })) {
                return true;
            }
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: '⏳', title: t('COOLDOWN_TITLE'), text: t('COOLDOWN_TEXT', { time: formatDuration(res.nextInMs) }) })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }).catch(() => null);
            return true;
        }

        if (!res.ok) {
            await interaction.followUp({
                content: '',
                components: [buildNoticeContainer({ emoji: '⚠️', title: t('ERROR_TITLE'), text: res.message || t('ERROR_GENERIC') })],
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
                    title: `${t('PLAY_PANEL_HEADER')} • ${zone.name}`,
                    text: [
                        t('SUCCESS_TEXT', { action: actionLine, amount: res.amount }),
                        balanceLine,
                        materialLines ? `\n${t('MATERIALS_HEADER')}\n${materialLines}` : '',
                    ].filter(Boolean).join('\n'),
                }),
            ],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);

        return true;
    }

    return false;
};
