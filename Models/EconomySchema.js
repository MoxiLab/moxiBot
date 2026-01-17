const mongoose = require('mongoose');

const STARTER_EGG_ITEM_ID = 'mascotas/huevo-de-bosque';

const ItemSchema = new mongoose.Schema({
    // Stable catalog identifier (e.g. "buffs/scroll-de-impulso-moxi")
    itemId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true }, // Buff, Coleccionable, Consumible, Herramienta, Llave, Loot, Mascota, Material, Mejora, Mision, Pocion, Rollo, Proteccion
    description: { type: String },
    rarity: { type: String, default: 'comun' },
    event: { type: String }, // Si es de evento especial
    attributes: { type: Object }, // Para stats extra, efectos, etc.
});

const UserEconomySchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 }, // Moneda principal
    bank: { type: Number, default: 0 }, // Banco
    sakuras: { type: Number, default: 0 }, // Moneda secundaria
    inventory: {
        type: [{
            itemId: { type: String, required: true },
            amount: { type: Number, default: 1 },
            obtainedAt: { type: Date, default: Date.now }
        }],
        default: () => ([{ itemId: STARTER_EGG_ITEM_ID, amount: 1, obtainedAt: new Date() }]),
    },
    petIncubation: {
        eggItemId: { type: String },
        startedAt: { type: Date },
        hatchAt: { type: Date },
    },
    pets: [{
        petId: { type: Number },
        name: { type: String },
        level: { type: Number, default: 1 },
        attributes: { type: Object }
    }],
    clubs: [{
        clubId: { type: String },
        joinedAt: { type: Date, default: Date.now }
    }],
    quests: [{
        questId: { type: String },
        status: { type: String, default: 'active' },
        progress: { type: Object }
    }],

    // --- Work system (empleos) ---
    workJobId: { type: String },
    workStartedAt: { type: Date },
    workTotalEarned: { type: Number, default: 0 },
    workShifts: { type: Number, default: 0 },

    lastDaily: { type: Date },
    lastWork: { type: Date },
    lastFish: { type: Date },
    lastMine: { type: Date },
    lastExplore: { type: Date },
    lastCrime: { type: Date },
});

module.exports = {
    Item: mongoose.model('Item', ItemSchema),
    UserEconomy: mongoose.model('UserEconomy', UserEconomySchema)
};
