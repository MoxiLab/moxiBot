const { pickRandom } = require('./activityUtils');

function listFishActivities() {
    return [
        { id: 'lanzar-cana', name: 'Lanzar la caña', nameKey: 'ACTIVITY_LANZAR_CANA_NAME', phrase: 'Has lanzado la caña', phraseKey: 'ACTIVITY_LANZAR_CANA_PHRASE', multiplier: 1.0 },
        { id: 'cambiar-cebo', name: 'Cambiar el cebo', nameKey: 'ACTIVITY_CAMBIAR_CEBO_NAME', phrase: 'Has cambiado el cebo', phraseKey: 'ACTIVITY_CAMBIAR_CEBO_PHRASE', multiplier: 0.95 },
        { id: 'pesca-profunda', name: 'Pesca profunda', nameKey: 'ACTIVITY_PESCA_PROFUNDA_NAME', phrase: 'Has hecho pesca profunda', phraseKey: 'ACTIVITY_PESCA_PROFUNDA_PHRASE', multiplier: 1.15 },
        { id: 'arrastrar-red', name: 'Arrastrar la red', nameKey: 'ACTIVITY_ARRASTRAR_RED_NAME', phrase: 'Has arrastrado la red', phraseKey: 'ACTIVITY_ARRASTRAR_RED_PHRASE', multiplier: 1.05 },
        { id: 'paciencia', name: 'Esperar con paciencia', nameKey: 'ACTIVITY_PACIENCIA_NAME', phrase: 'Has esperado con paciencia', phraseKey: 'ACTIVITY_PACIENCIA_PHRASE', multiplier: 0.9 },
    ];
}

function pickFishActivity() {
    return pickRandom(listFishActivities()) || { id: 'lanzar-cana', name: 'Lanzar la caña', multiplier: 1.0 };
}

module.exports = {
    listFishActivities,
    pickFishActivity,
};
