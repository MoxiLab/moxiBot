const { pickRandom } = require('./activityUtils');

function listMineActivities({ isExplosive } = {}) {
    const base = [
        { id: 'picar-veta', name: 'Picar una veta', phrase: 'Has picado una veta', phraseKey: 'ACTIVITY_PICAR_VETA_PHRASE', multiplier: 1.0 },
        { id: 'cribar-escombros', name: 'Cribar escombros', phrase: 'Has cribado escombros', phraseKey: 'ACTIVITY_CRIBAR_ESCOMBROS_PHRASE', multiplier: 0.95 },
        { id: 'espachurrar-rocas', name: 'Espachurrar rocas', phrase: 'Has espachurrado rocas', phraseKey: 'ACTIVITY_ESPACHURRAR_ROCAS_PHRASE', multiplier: 1.05 },
        { id: 'sondear-grietas', name: 'Sondear grietas', phrase: 'Has sondeado grietas', phraseKey: 'ACTIVITY_SONDEAR_GRIETAS_PHRASE', multiplier: 1.1 },
    ];

    if (isExplosive) {
        base.push({ id: 'detonar-carga', name: 'Detonar una carga', phrase: 'Has detonado una carga', phraseKey: 'ACTIVITY_DETONAR_CARGA_PHRASE', multiplier: 1.25 });
    }

    return base;
}

function pickMineActivity(zone) {
    const requiredId = String(zone?.requiredItemId || '');
    const isExplosive = requiredId.includes('dinamita');
    return pickRandom(listMineActivities({ isExplosive })) || { id: 'picar-veta', name: 'Picar una veta', multiplier: 1.0 };
}

module.exports = {
    listMineActivities,
    pickMineActivity,
};
