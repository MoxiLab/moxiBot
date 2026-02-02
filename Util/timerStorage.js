const { setTimeout, clearTimeout } = require('timers');
const timers = {};
const TimerModel = require('../Models/TimerSchema');
const { ensureMongoConnection } = require('./mongoConnect');

async function restoreTimers(onFinish) {
    try {
        // Asegurar conexión antes de consultar (evita "buffering timed out").
        await ensureMongoConnection().catch(() => null);

        const all = await TimerModel.find({});
        for (const t of all) {
            const msLeft = t.endTime - Date.now();
            if (msLeft > 0) {
                const timeoutId = setTimeout(() => {
                    if (onFinish) onFinish(t.guildId, t.channelId, t.userId, t.minutos);
                    delete timers[t.guildId][t.channelId];
                    TimerModel.deleteOne({ guildId: t.guildId, channelId: t.channelId }).catch(() => { });
                }, msLeft);
                if (!timers[t.guildId]) timers[t.guildId] = {};
                timers[t.guildId][t.channelId] = { userId: t.userId, endTime: t.endTime, timeoutId };
            } else {
                // Si ya expiró, eliminar de MongoDB
                TimerModel.deleteOne({ guildId: t.guildId, channelId: t.channelId }).catch(() => { });
            }
        }
    } catch (err) {
        console.error('[timerStorage] Error restaurando temporizadores desde MongoDB:', err);
    }
}

async function setTimer(guildId, channelId, userId, minutos, onFinish) {
    if (!timers[guildId]) timers[guildId] = {};
    if (timers[guildId][channelId]) clearTimeout(timers[guildId][channelId].timeoutId);
    const endTime = Date.now() + minutos * 60 * 1000;
    const timeoutId = setTimeout(() => {
        if (onFinish) onFinish();
        delete timers[guildId][channelId];
        // Eliminar de MongoDB al finalizar
        TimerModel.deleteOne({ guildId, channelId }).catch(() => { });
    }, minutos * 60 * 1000);
    timers[guildId][channelId] = { userId, endTime, timeoutId };
    // Guardar en MongoDB
    try {
        await ensureMongoConnection().catch(() => null);
        await TimerModel.findOneAndUpdate(
            { guildId, channelId },
            { guildId, channelId, userId, endTime, minutos },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('[timerStorage] No se pudo guardar el temporizador en MongoDB:', err);
    }
}

function getTimer(guildId, channelId) {
    return timers[guildId]?.[channelId] || null;
}

function clearTimer(guildId, channelId) {
    if (timers[guildId]?.[channelId]) {
        clearTimeout(timers[guildId][channelId].timeoutId);
        delete timers[guildId][channelId];
    }
    // Eliminar también de MongoDB aunque no esté en memoria
    ensureMongoConnection()
        .then(() => TimerModel.deleteOne({ guildId, channelId }).catch(() => { }))
        .catch(() => null);
}

function getAllTimers() {
    // Devuelve todos los temporizadores activos
    const result = [];
    for (const guildId in timers) {
        for (const channelId in timers[guildId]) {
            result.push({
                guildId,
                channelId,
                ...timers[guildId][channelId]
            });
        }
    }
    return result;
}

module.exports = { setTimer, getTimer, clearTimer, getAllTimers, restoreTimers };
