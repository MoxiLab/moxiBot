const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('../../../../Util/economyCore');
const { randInt, chance } = require('../../../../Util/activityUtils');
const { getCrimeActivity } = require('../../../../Util/crimeActivities');
const { parseCrimeCustomId, buildCrimeMessageOptions } = require('../../../../Util/crimeView');
const { crimeActivityTitle, crimeOptionLabel, crimeDoorLabel, crimeRiskLabel, crimeWireLabel } = require('../../../../Util/crimeI18n');

const CRIME_COOLDOWN_MS = 5 * 60 * 1000;

async function takeBalance({ userId, amount } = {}) {
    const { Economy } = require('../../../../Models/EconomySchema');

    const eco = await getOrCreateEconomy(userId);
    const current = Number.isFinite(eco?.balance) ? eco.balance : 0;
    const loss = Math.max(0, Math.min(current, Math.trunc(Number(amount) || 0)));

    if (loss <= 0) {
        return { ok: true, amount: 0, balance: current };
    }

    const updated = await Economy.findOneAndUpdate(
        { userId },
        { $inc: { balance: -loss } },
        { new: true }
    );

    return { ok: true, amount: loss, balance: Number.isFinite(updated?.balance) ? updated.balance : Math.max(0, current - loss) };
}

function noticeMessage({ emoji, title, text }) {
    return {
        content: '',
        components: [buildNoticeContainer({ emoji, title, text })],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

module.exports = async function crimeButtons(interaction, Moxi, logger) {
    if (!interaction.isButton()) return false;

    const parsed = parseCrimeCustomId(interaction.customId);
    if (!parsed) return false;

    const { action, userId, parts } = parsed;

    if (interaction.user?.id !== String(userId)) {
        await interaction.reply({ content: 'Solo quien abrió este panel puede usar estos botones.', flags: MessageFlags.Ephemeral }).catch(() => null);
        return true;
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    if (action === 'close') {
        // Mantener la vista, pero deshabilitar interacciones
        const activityId = parts[3];
        const seed = Number.parseInt(parts[4], 10);
        const payload = buildCrimeMessageOptions({
            lang,
            userId,
            activityId,
            state: {
                disabled: true,
                seed: Number.isFinite(seed) ? seed : undefined,
            },
        });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (action === 'reroll') {
        const payload = buildCrimeMessageOptions({ lang, userId });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (action !== 'do') return false;

    // crime:do:<userId>:<activityId>:<choice>[:seed]
    const activityId = parts[3];
    const choice = parts[4];
    const seedRaw = parts[5];

    const activity = getCrimeActivity(activityId);
    if (!activity) {
        await interaction.update(noticeMessage({ emoji: EMOJIS.cross, title: 'Crime', text: 'Esa actividad ya no existe.' })).catch(() => null);
        return true;
    }

    // Mantener el panel: deferUpdate y actualizar el mismo mensaje (sin ephemeral)
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => null);
    }

    const cd = await claimCooldown({ userId, field: 'lastCrime', cooldownMs: CRIME_COOLDOWN_MS });
    if (!cd.ok && cd.reason === 'cooldown') {
        const payload = {
            content: '',
            components: [buildNoticeContainer({
                emoji: '⏳',
                title: 'Crime • Cooldown',
                text: `Aún es muy pronto. Vuelve en **${formatDuration(cd.nextInMs)}**.`,
            })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        };
        await interaction.followUp(payload).catch(() => null);
        return true;
    }

    if (!cd.ok) {
        const payload = buildCrimeMessageOptions({
            lang,
            userId,
            activityId,
            state: {
                notice: { emoji: '⚠️', title: 'Crime', text: cd.message || 'No pude procesarlo ahora mismo.' },
                seed: Number.isFinite(Number.parseInt(seedRaw, 10)) ? Number.parseInt(seedRaw, 10) : undefined,
            },
        });
        await interaction.editReply(payload).catch(() => null);
        return true;
    }

    let success = false;
    let successChance = null;
    let rewardRange = null;
    let fineRange = null;
    let extraTitle = '';

    if (activity.kind === 'buttons') {
        const opt = (activity.options || []).find(o => String(o.id) === String(choice));
        if (!opt) {
            const payload = buildCrimeMessageOptions({
                lang,
                userId,
                activityId,
                state: {
                    notice: { emoji: EMOJIS.cross, title: 'Crime', text: 'Opción inválida.' },
                },
            });
            await interaction.editReply(payload).catch(() => null);
            return true;
        }
        successChance = opt.successChance;
        rewardRange = opt.reward;
        fineRange = opt.fine;
        extraTitle = crimeOptionLabel(lang, opt.id);
        success = chance(successChance);
    } else if (activity.kind === 'doors') {
        const seed = Number.parseInt(seedRaw, 10);
        const doors = (activity.doors || []).slice(0, 3);
        const goodIdx = Number.isFinite(seed) ? Math.max(0, Math.min(2, seed)) : 0;
        const goodDoorId = doors[goodIdx]?.id;
        rewardRange = activity.reward;
        fineRange = activity.fine;
        extraTitle = crimeDoorLabel(lang, choice);
        success = String(choice) === String(goodDoorId);
    } else if (activity.kind === 'risk') {
        const r = (activity.risks || []).find(x => String(x.id) === String(choice));
        if (!r) {
            const payload = buildCrimeMessageOptions({
                lang,
                userId,
                activityId,
                state: {
                    notice: { emoji: EMOJIS.cross, title: 'Crime', text: 'Riesgo inválido.' },
                },
            });
            await interaction.editReply(payload).catch(() => null);
            return true;
        }
        successChance = r.successChance;
        rewardRange = r.reward;
        fineRange = r.fine;
        extraTitle = crimeRiskLabel(lang, r.id);
        success = chance(successChance);
    } else if (activity.kind === 'wires') {
        const seed = Number.parseInt(seedRaw, 10);
        const wires = (activity.wires || []).slice(0, 4);
        const goodIdx = Number.isFinite(seed) ? Math.max(0, Math.min(3, seed)) : 0;
        const goodWireId = wires[goodIdx]?.id;
        rewardRange = activity.reward;
        fineRange = activity.fine;
        extraTitle = crimeWireLabel(lang, choice);
        success = String(choice) === String(goodWireId);
    } else {
        const payload = buildCrimeMessageOptions({
            lang,
            userId,
            activityId,
            state: {
                notice: { emoji: EMOJIS.cross, title: 'Crime', text: 'Actividad no soportada.' },
                seed: Number.isFinite(Number.parseInt(seedRaw, 10)) ? Number.parseInt(seedRaw, 10) : undefined,
            },
        });
        await interaction.editReply(payload).catch(() => null);
        return true;
    }

    const coin = EMOJIS.coin || '🪙';

    if (success) {
        const amount = randInt(rewardRange?.min ?? 40, rewardRange?.max ?? 150);
        const res = await awardBalance({ userId, amount });
        if (!res.ok) {
            const payload = buildCrimeMessageOptions({
                lang,
                userId,
                activityId,
                state: {
                    notice: { emoji: '⚠️', title: 'Crime', text: res.message || 'No pude darte la recompensa.' },
                    seed: Number.isFinite(Number.parseInt(seedRaw, 10)) ? Number.parseInt(seedRaw, 10) : undefined,
                },
            });
            await interaction.editReply(payload).catch(() => null);
            return true;
        }

        const lines = [
            `${activity.emoji || '🕵️'} **${crimeActivityTitle(lang, activity)}**${extraTitle ? ` • ${extraTitle}` : ''}`,
            'Te salió bien.',
            `Ganaste **+${res.amount}** ${coin}.`,
            Number.isFinite(res?.balance) ? `Saldo: **${res.balance}** ${coin}` : '',
        ].filter(Boolean);

        const disabledPanel = buildCrimeMessageOptions({
            lang,
            userId,
            activityId: activity.id,
            state: {
                disabled: true,
                seed: Number.isFinite(Number.parseInt(seedRaw, 10)) ? Number.parseInt(seedRaw, 10) : undefined,
                notice: { emoji: '✅', title: 'Crime • Éxito', text: lines.join('\n') },
            },
        });

        await interaction.editReply(disabledPanel).catch(() => null);
    } else {
        const fine = randInt(fineRange?.min ?? 20, fineRange?.max ?? 120);
        const res = await takeBalance({ userId, amount: fine });

        const lines = [
            `${activity.emoji || '🕵️'} **${crimeActivityTitle(lang, activity)}**${extraTitle ? ` • ${extraTitle}` : ''}`,
            'Te pillaron o salió mal.',
            res.amount > 0 ? `Perdiste **-${res.amount}** ${coin}.` : 'No tenías monedas para perder… por esta vez.',
            Number.isFinite(res?.balance) ? `Saldo: **${res.balance}** ${coin}` : '',
        ].filter(Boolean);

        const disabledPanel = buildCrimeMessageOptions({
            lang,
            userId,
            activityId: activity.id,
            state: {
                disabled: true,
                seed: Number.isFinite(Number.parseInt(seedRaw, 10)) ? Number.parseInt(seedRaw, 10) : undefined,
                notice: { emoji: '🚓', title: 'Crime • Fallo', text: lines.join('\n') },
            },
        });

        await interaction.editReply(disabledPanel).catch(() => null);
    }
    return true;
};
