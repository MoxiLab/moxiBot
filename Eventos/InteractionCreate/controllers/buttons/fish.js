const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { getItemById } = require('../../../../Util/inventoryCatalog');
const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('../../../../Util/economyCore');
const { pickFishActivity } = require('../../../../Util/fishActivities');
const { scaleRange, randInt, chance } = require('../../../../Util/activityUtils');
const {
    parseFishCustomId,
    buildFishZonesContainer,
    getZoneForPick,
    hasInventoryItem,
} = require('../../../../Util/fishView');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.trunc(x);
}

const FISH_FAIL_CHANCE = 0.22;

module.exports = async function fishButtons(interaction) {
    const parsed = parseFishCustomId(interaction?.customId);
    if (!parsed) return false;

    const { action, userId, page, index } = parsed;

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
            const required = getItemById(zone.requiredItemId);
            const requiredName = required?.name || zone.requiredItemId;
            const payload = {
                content: '',
                components: [
                    buildNoticeContainer({
                        emoji: EMOJIS.noEntry,
                        title: 'Fish • Requisito',
                        text: `Para pescar en **${zone.name}** necesitas: **${requiredName}**\nID: \`${zone.requiredItemId}\``,
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

        const cooldownMs = Math.max(1, safeInt(300, 300)) * 1000; // default; el comando puede ajustar su cooldown por texto
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

        await interaction.followUp({
            content: '',
            components: [
                buildNoticeContainer({
                    emoji: zone.emoji || '🎣',
                    title: `Fish • ${zone.name}`,
                    text: [
                        `${actionLine} y ganaste **${res.amount}** 🪙. ¡Buen lance! 🎣`,
                        balanceLine,
                    ].filter(Boolean).join('\n'),
                }),
            ],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);

        return true;
    }

    return false;
};
