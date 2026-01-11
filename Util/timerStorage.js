// Utilidad para almacenar temporizadores activos por canal/guild
// Estructura: { [guildId]: { [channelId]: { userId, endTime, timeoutId } } }
const timers = {};

function setTimer(guildId, channelId, userId, minutos, onFinish) {
    if (!timers[guildId]) timers[guildId] = {};
    if (timers[guildId][channelId]) clearTimeout(timers[guildId][channelId].timeoutId);
    const endTime = Date.now() + minutos * 60 * 1000;
    const timeoutId = setTimeout(() => {
        if (onFinish) onFinish();
        delete timers[guildId][channelId];
    }, minutos * 60 * 1000);
    timers[guildId][channelId] = { userId, endTime, timeoutId };
}

function getTimer(guildId, channelId) {
    return timers[guildId]?.[channelId] || null;
}

function clearTimer(guildId, channelId) {
    if (timers[guildId]?.[channelId]) {
        clearTimeout(timers[guildId][channelId].timeoutId);
        delete timers[guildId][channelId];
    }
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

module.exports = { setTimer, getTimer, clearTimer, getAllTimers };
