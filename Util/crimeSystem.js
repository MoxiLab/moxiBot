const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('./economyCore');
const { randInt, chance, pickRandom } = require('./activityUtils');
const { pickRandomCrimeActivity } = require('./crimeActivities');

const CRIME_COOLDOWN_MS = 5 * 60 * 1000;

async function takeBalance({ userId, amount } = {}) {
    const { Economy } = require('../Models/EconomySchema');

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

    return {
        ok: true,
        amount: loss,
        balance: Number.isFinite(updated?.balance) ? updated.balance : Math.max(0, current - loss),
    };
}

function pickCrimeOutcome(activity) {
    const act = activity || pickRandomCrimeActivity();

    if (act.kind === 'buttons') {
        const opt = pickRandom(act.options);
        return {
            activity: act,
            choiceId: opt?.id || '',
            rewardRange: opt?.reward,
            fineRange: opt?.fine,
            success: chance(opt?.successChance ?? 0),
        };
    }

    if (act.kind === 'doors') {
        const doors = Array.isArray(act.doors) ? act.doors : [];
        const chosen = pickRandom(doors) || doors[0];
        const good = pickRandom(doors) || doors[0];
        return {
            activity: act,
            choiceId: chosen?.id || '',
            rewardRange: act.reward,
            fineRange: act.fine,
            success: Boolean(chosen && good && String(chosen.id) === String(good.id)),
        };
    }

    if (act.kind === 'risk') {
        const r = pickRandom(act.risks);
        return {
            activity: act,
            choiceId: r?.id || '',
            rewardRange: r?.reward,
            fineRange: r?.fine,
            success: chance(r?.successChance ?? 0),
        };
    }

    return {
        activity: act,
        choiceId: '',
        rewardRange: { min: 40, max: 150 },
        fineRange: { min: 20, max: 120 },
        success: chance(0.5),
    };
}

async function doCrime({ userId } = {}) {
    const uid = String(userId || '').trim();
    if (!uid) return { ok: false, message: 'Falta userId.' };

    const cd = await claimCooldown({ userId: uid, field: 'lastCrime', cooldownMs: CRIME_COOLDOWN_MS });
    if (!cd.ok && cd.reason === 'cooldown') {
        return { ok: false, reason: 'cooldown', nextInMs: cd.nextInMs, message: `Aún es muy pronto. Vuelve en **${formatDuration(cd.nextInMs)}**.` };
    }
    if (!cd.ok) {
        return { ok: false, message: cd.message || 'No pude procesarlo ahora mismo.' };
    }

    const outcome = pickCrimeOutcome(pickRandomCrimeActivity());
    const activity = outcome.activity;

    if (outcome.success) {
        const amount = randInt(outcome.rewardRange?.min ?? 40, outcome.rewardRange?.max ?? 150);
        const res = await awardBalance({ userId: uid, amount });
        if (!res.ok) {
            return { ok: false, message: res.message || 'No pude darte la recompensa.' };
        }

        return {
            ok: true,
            success: true,
            activity,
            activityId: activity?.id,
            kind: activity?.kind,
            emoji: activity?.emoji,
            choiceId: outcome.choiceId,
            amount: res.amount,
            balance: res.balance,
        };
    }

    const fine = randInt(outcome.fineRange?.min ?? 20, outcome.fineRange?.max ?? 120);
    const res = await takeBalance({ userId: uid, amount: fine });

    return {
        ok: true,
        success: false,
        activity,
        activityId: activity?.id,
        kind: activity?.kind,
        emoji: activity?.emoji,
        choiceId: outcome.choiceId,
        amount: res.amount,
        balance: res.balance,
    };
}

module.exports = {
    CRIME_COOLDOWN_MS,
    doCrime,
};
