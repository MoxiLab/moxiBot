const { pickRandom } = require('./activityUtils');

function listFishActivities() {
    return [
        { id: 'lanzar-cana', name: 'Lanzar la caña', phrase: 'Has lanzado la caña', multiplier: 1.0 },
        { id: 'cambiar-cebo', name: 'Cambiar el cebo', phrase: 'Has cambiado el cebo', multiplier: 0.95 },
        { id: 'pesca-profunda', name: 'Pesca profunda', phrase: 'Has hecho pesca profunda', multiplier: 1.15 },
        { id: 'arrastrar-red', name: 'Arrastrar la red', phrase: 'Has arrastrado la red', multiplier: 1.05 },
        { id: 'paciencia', name: 'Esperar con paciencia', phrase: 'Has esperado con paciencia', multiplier: 0.9 },
    ];
}

function pickFishActivity() {
    return pickRandom(listFishActivities()) || { id: 'lanzar-cana', name: 'Lanzar la caña', multiplier: 1.0 };
}

module.exports = {
    listFishActivities,
    pickFishActivity,
};
