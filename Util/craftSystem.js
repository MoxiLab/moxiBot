const { ensureMongoConnection } = require('./mongoConnect');
const { getItemById, assertValidItemId } = require('./inventoryCatalog');

function normalizeText(input) {
    return String(input || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function makeRecipe({ itemId, amount = 1, cost = 10, inputs = [] }) {
    return {
        id: itemId,
        cost,
        output: { itemId, amount },
        inputs,
    };
}

// Recetas (puedes ajustar libremente)
const RECIPES = Object.freeze([
    // --- Herramientas ---
    makeRecipe({
        itemId: 'herramientas/pico-prisma',
        cost: 5,
        inputs: [
            { itemId: 'materiales/mineral-elemental', amount: 5 },
            { itemId: 'materiales/barra-de-oro-acero', amount: 2 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'herramientas/cana-de-pesca-moxi',
        cost: 5,
        inputs: [
            { itemId: 'materiales/hierba-prisma', amount: 6 },
            { itemId: 'materiales/barra-de-oro-acero', amount: 1 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'herramientas/dinamita',
        cost: 25,
        inputs: [
            { itemId: 'materiales/roca-volcanica', amount: 5 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'herramientas/llave-multiusos',
        cost: 25,
        inputs: [
            { itemId: 'materiales/barra-de-oro-acero', amount: 3 },
            { itemId: 'materiales/mineral-elemental', amount: 2 },
        ],
    }),
    makeRecipe({
        itemId: 'herramientas/revelador-prisma',
        cost: 25,
        inputs: [
            { itemId: 'materiales/fragmento-de-espiritu', amount: 4 },
            { itemId: 'materiales/mineral-elemental', amount: 2 },
        ],
    }),
    makeRecipe({
        itemId: 'herramientas/golem-minero-pescador',
        cost: 50,
        inputs: [
            { itemId: 'materiales/mineral-elemental', amount: 10 },
            { itemId: 'materiales/barra-de-oro-acero', amount: 6 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 4 },
        ],
    }),
    makeRecipe({
        itemId: 'herramientas/varita-solar',
        cost: 25,
        inputs: [
            { itemId: 'materiales/barra-de-oro-acero', amount: 3 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 2 },
            { itemId: 'materiales/mineral-elemental', amount: 2 },
        ],
    }),
    makeRecipe({
        itemId: 'herramientas/hacha-elemental',
        cost: 25,
        inputs: [
            { itemId: 'materiales/mineral-elemental', amount: 4 },
            { itemId: 'materiales/barra-de-oro-acero', amount: 2 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'herramientas/incubadora',
        cost: 25,
        inputs: [
            { itemId: 'materiales/barra-de-oro-acero', amount: 4 },
            { itemId: 'materiales/mineral-elemental', amount: 3 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 2 },
        ],
    }),
    makeRecipe({
        itemId: 'herramientas/barco-moxi',
        cost: 50,
        inputs: [
            { itemId: 'materiales/barra-de-oro-acero', amount: 6 },
            { itemId: 'materiales/mineral-elemental', amount: 4 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 2 },
            { itemId: 'materiales/roca-volcanica', amount: 4 },
        ],
    }),

    // --- Llaves ---
    makeRecipe({
        itemId: 'llaves/llave-prisma',
        cost: 25,
        inputs: [
            { itemId: 'materiales/mineral-elemental', amount: 2 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 2 },
            { itemId: 'materiales/barra-de-oro-acero', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'llaves/llave-elemental',
        cost: 25,
        inputs: [
            { itemId: 'materiales/mineral-elemental', amount: 3 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 3 },
            { itemId: 'materiales/barra-de-oro-acero', amount: 2 },
        ],
    }),
    makeRecipe({
        itemId: 'llaves/talisman-solar',
        cost: 25,
        inputs: [
            { itemId: 'materiales/barra-de-oro-acero', amount: 3 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 2 },
            { itemId: 'materiales/roca-volcanica', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'llaves/anillo-de-fuego',
        cost: 25,
        inputs: [
            { itemId: 'materiales/barra-de-oro-acero', amount: 2 },
            { itemId: 'materiales/roca-volcanica', amount: 4 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 2 },
        ],
    }),

    // --- Consumibles (no incluye monedas) ---
    makeRecipe({
        itemId: 'consumibles/galleta-energetica',
        cost: 10,
        inputs: [
            { itemId: 'materiales/dulce-festivo', amount: 1 },
            { itemId: 'materiales/hierba-prisma', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'consumibles/pastel-de-celebracion',
        cost: 10,
        inputs: [
            { itemId: 'materiales/dulce-festivo', amount: 2 },
            { itemId: 'materiales/flor-de-amor', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'consumibles/fruta-magica',
        cost: 10,
        inputs: [
            { itemId: 'materiales/hierba-prisma', amount: 2 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'consumibles/ensalada-refrescante',
        cost: 10,
        inputs: [
            { itemId: 'materiales/hierba-prisma', amount: 3 },
            { itemId: 'materiales/flor-de-amor', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'consumibles/fuegos-artificiales',
        cost: 10,
        inputs: [
            { itemId: 'materiales/roca-volcanica', amount: 2 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 1 },
            { itemId: 'materiales/dulce-festivo', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'consumibles/calabaza-festiva',
        cost: 10,
        inputs: [
            { itemId: 'materiales/dulce-festivo', amount: 2 },
            { itemId: 'materiales/fosil', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'consumibles/nuez-dorada',
        cost: 10,
        inputs: [
            { itemId: 'materiales/barra-de-oro-acero', amount: 1 },
            { itemId: 'materiales/mineral-elemental', amount: 1 },
            { itemId: 'materiales/dulce-festivo', amount: 1 },
        ],
    }),
    makeRecipe({
        itemId: 'consumibles/electrolito',
        cost: 10,
        inputs: [
            { itemId: 'materiales/hierba-prisma', amount: 2 },
            { itemId: 'materiales/fragmento-de-espiritu', amount: 2 },
        ],
    }),

    // --- Buffs ---
    makeRecipe({ itemId: 'buffs/scroll-de-impulso-moxi', cost: 10, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),
    makeRecipe({ itemId: 'buffs/pez-lumina', cost: 10, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }, { itemId: 'materiales/flor-de-amor', amount: 1 }] }),
    makeRecipe({ itemId: 'buffs/gusano-brillo', cost: 10, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 1 }, { itemId: 'materiales/fosil', amount: 2 }] }),
    makeRecipe({ itemId: 'buffs/linterna-solar', cost: 10, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }, { itemId: 'materiales/roca-volcanica', amount: 2 }] }),
    makeRecipe({ itemId: 'buffs/fruta-vital', cost: 10, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 2 }, { itemId: 'materiales/hierba-prisma', amount: 2 }] }),
    makeRecipe({ itemId: 'buffs/scroll-mascota-veloz', cost: 10, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }, { itemId: 'materiales/hierba-prisma', amount: 1 }] }),
    makeRecipe({ itemId: 'buffs/fruta-mutante', cost: 10, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 3 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 3 }] }),
    makeRecipe({ itemId: 'buffs/holly-prisma', cost: 10, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 3 }, { itemId: 'materiales/flor-de-amor', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'buffs/pan-dulce-moxi', cost: 10, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 4 }, { itemId: 'materiales/flor-de-amor', amount: 1 }] }),
    makeRecipe({ itemId: 'buffs/pase-de-evento', cost: 10, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 2 }, { itemId: 'materiales/dulce-festivo', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),
    makeRecipe({ itemId: 'buffs/fogata-elemental', cost: 10, inputs: [{ itemId: 'materiales/roca-volcanica', amount: 4 }, { itemId: 'materiales/barra-de-oro-acero', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'buffs/scroll-gelido', cost: 10, inputs: [{ itemId: 'materiales/fosil', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }, { itemId: 'materiales/roca-volcanica', amount: 1 }] }),
    makeRecipe({ itemId: 'buffs/corona-de-invierno', cost: 10, inputs: [{ itemId: 'materiales/fosil', amount: 2 }, { itemId: 'materiales/dulce-festivo', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'buffs/dulce-de-fresa', cost: 10, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 2 }, { itemId: 'materiales/flor-de-amor', amount: 1 }] }),
    makeRecipe({ itemId: 'buffs/trebol-de-fortuna', cost: 10, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 3 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),
    makeRecipe({ itemId: 'buffs/cascanueces-moxi', cost: 10, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 1 }, { itemId: 'materiales/dulce-festivo', amount: 3 }, { itemId: 'materiales/roca-volcanica', amount: 1 }] }),

    // --- Coleccionables ---
    makeRecipe({ itemId: 'coleccionables/medalla-de-nieve', cost: 10, inputs: [{ itemId: 'materiales/fosil', amount: 1 }, { itemId: 'materiales/dulce-festivo', amount: 1 }] }),
    makeRecipe({ itemId: 'coleccionables/medalla-prisma', cost: 10, inputs: [{ itemId: 'materiales/fragmento-de-espiritu', amount: 1 }, { itemId: 'materiales/mineral-elemental', amount: 1 }] }),
    makeRecipe({ itemId: 'coleccionables/medalla-lunar', cost: 10, inputs: [{ itemId: 'materiales/fosil', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'coleccionables/token-festivo', cost: 10, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 2 }] }),
    makeRecipe({ itemId: 'coleccionables/carta-de-amistad', cost: 10, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 2 }, { itemId: 'materiales/hierba-prisma', amount: 1 }] }),
    makeRecipe({ itemId: 'coleccionables/moneda-de-fortuna', cost: 10, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'coleccionables/gema-de-espiritu', cost: 10, inputs: [{ itemId: 'materiales/fragmento-de-espiritu', amount: 3 }, { itemId: 'materiales/mineral-elemental', amount: 1 }] }),
    makeRecipe({ itemId: 'coleccionables/corazon-prisma', cost: 10, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 3 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'coleccionables/petalo-de-sakura', cost: 10, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 1 }, { itemId: 'materiales/hierba-prisma', amount: 2 }] }),
    makeRecipe({ itemId: 'coleccionables/bouquet-festivo', cost: 10, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 4 }, { itemId: 'materiales/dulce-festivo', amount: 1 }] }),
    makeRecipe({ itemId: 'coleccionables/ticket-de-temporada', cost: 10, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 2 }, { itemId: 'materiales/barra-de-oro-acero', amount: 1 }] }),
    makeRecipe({ itemId: 'coleccionables/varita-de-luz', cost: 10, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),
    makeRecipe({ itemId: 'coleccionables/cascabel-festivo', cost: 10, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 1 }, { itemId: 'materiales/dulce-festivo', amount: 2 }] }),
    makeRecipe({ itemId: 'coleccionables/flor-de-espiritu', cost: 10, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),
    makeRecipe({ itemId: 'coleccionables/fantasmita-moxi', cost: 10, inputs: [{ itemId: 'materiales/fosil', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),
    makeRecipe({ itemId: 'coleccionables/gato-sombrio', cost: 10, inputs: [{ itemId: 'materiales/fosil', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }, { itemId: 'materiales/roca-volcanica', amount: 1 }] }),
    makeRecipe({ itemId: 'coleccionables/copa-de-campeon', cost: 25, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 3 }, { itemId: 'materiales/mineral-elemental', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),

    // --- Loots ---
    makeRecipe({ itemId: 'loots/caja-misteriosa', cost: 25, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 1 }, { itemId: 'materiales/dulce-festivo', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'loots/cofre-de-fortuna', cost: 25, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }, { itemId: 'materiales/flor-de-amor', amount: 1 }] }),
    makeRecipe({ itemId: 'loots/caja-marina', cost: 25, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }, { itemId: 'materiales/barra-de-oro-acero', amount: 1 }] }),
    makeRecipe({ itemId: 'loots/caja-premium-diamante-platino', cost: 50, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 3 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 3 }, { itemId: 'materiales/mineral-elemental', amount: 2 }] }),
    makeRecipe({ itemId: 'loots/pack-de-celebracion', cost: 25, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 4 }, { itemId: 'materiales/flor-de-amor', amount: 2 }] }),
    makeRecipe({ itemId: 'loots/caja-de-suerte', cost: 25, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 3 }, { itemId: 'materiales/barra-de-oro-acero', amount: 1 }] }),
    makeRecipe({ itemId: 'loots/tarjeta-de-regalo', cost: 25, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 3 }, { itemId: 'materiales/barra-de-oro-acero', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),

    // --- Mascotas (Huevos) ---
    makeRecipe({ itemId: 'mascotas/huevo-festivo', cost: 25, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 5 }, { itemId: 'materiales/flor-de-amor', amount: 2 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-solar', cost: 25, inputs: [{ itemId: 'materiales/roca-volcanica', amount: 2 }, { itemId: 'materiales/flor-de-amor', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-brumoso', cost: 25, inputs: [{ itemId: 'materiales/fosil', amount: 2 }, { itemId: 'materiales/hierba-prisma', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-de-bosque', cost: 25, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 5 }, { itemId: 'materiales/flor-de-amor', amount: 1 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-de-montana', cost: 25, inputs: [{ itemId: 'materiales/roca-volcanica', amount: 5 }, { itemId: 'materiales/mineral-elemental', amount: 2 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-jardin', cost: 25, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 3 }, { itemId: 'materiales/hierba-prisma', amount: 3 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-torbellino', cost: 25, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 2 }, { itemId: 'materiales/fosil', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-fertil', cost: 25, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 4 }, { itemId: 'materiales/flor-de-amor', amount: 1 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-coral', cost: 25, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 3 }, { itemId: 'materiales/roca-volcanica', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-encantado', cost: 25, inputs: [{ itemId: 'materiales/fragmento-de-espiritu', amount: 3 }, { itemId: 'materiales/flor-de-amor', amount: 1 }, { itemId: 'materiales/hierba-prisma', amount: 1 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-guardian', cost: 25, inputs: [{ itemId: 'materiales/roca-volcanica', amount: 3 }, { itemId: 'materiales/barra-de-oro-acero', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }] }),

    makeRecipe({ itemId: 'mascotas/huevo-de-tormenta', cost: 35, inputs: [{ itemId: 'materiales/mineral-elemental', amount: 3 }, { itemId: 'materiales/barra-de-oro-acero', amount: 1 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-volcanico', cost: 35, inputs: [{ itemId: 'materiales/roca-volcanica', amount: 6 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }, { itemId: 'materiales/mineral-elemental', amount: 1 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-glaciar', cost: 35, inputs: [{ itemId: 'materiales/fosil', amount: 4 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-marino', cost: 35, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 5 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }, { itemId: 'materiales/barra-de-oro-acero', amount: 1 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-selvatico', cost: 35, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 6 }, { itemId: 'materiales/flor-de-amor', amount: 2 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-umbrio', cost: 35, inputs: [{ itemId: 'materiales/fosil', amount: 3 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 3 }, { itemId: 'materiales/roca-volcanica', amount: 1 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-radiante', cost: 35, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 3 }] }),

    makeRecipe({ itemId: 'mascotas/huevo-prisma', cost: 50, inputs: [{ itemId: 'materiales/mineral-elemental', amount: 6 }, { itemId: 'materiales/barra-de-oro-acero', amount: 4 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 4 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-elemental', cost: 50, inputs: [{ itemId: 'materiales/mineral-elemental', amount: 8 }, { itemId: 'materiales/barra-de-oro-acero', amount: 4 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 3 }, { itemId: 'materiales/roca-volcanica', amount: 3 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-magico', cost: 50, inputs: [{ itemId: 'materiales/fragmento-de-espiritu', amount: 8 }, { itemId: 'materiales/flor-de-amor', amount: 2 }, { itemId: 'materiales/barra-de-oro-acero', amount: 2 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-de-cristal', cost: 50, inputs: [{ itemId: 'materiales/mineral-elemental', amount: 5 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 5 }, { itemId: 'materiales/barra-de-oro-acero', amount: 3 }] }),

    makeRecipe({ itemId: 'mascotas/huevo-abisal', cost: 75, inputs: [{ itemId: 'materiales/fragmento-de-espiritu', amount: 10 }, { itemId: 'materiales/fosil', amount: 6 }, { itemId: 'materiales/barra-de-oro-acero', amount: 4 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-aurora', cost: 75, inputs: [{ itemId: 'materiales/fosil', amount: 8 }, { itemId: 'materiales/dulce-festivo', amount: 6 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 6 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-relampago', cost: 75, inputs: [{ itemId: 'materiales/mineral-elemental', amount: 10 }, { itemId: 'materiales/barra-de-oro-acero', amount: 6 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 6 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-lunar', cost: 75, inputs: [{ itemId: 'materiales/fosil', amount: 10 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 8 }, { itemId: 'materiales/flor-de-amor', amount: 3 }] }),

    makeRecipe({ itemId: 'mascotas/huevo-legendario', cost: 120, inputs: [{ itemId: 'materiales/mineral-elemental', amount: 15 }, { itemId: 'materiales/barra-de-oro-acero', amount: 10 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 10 }, { itemId: 'materiales/fosil', amount: 5 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-meteoro', cost: 120, inputs: [{ itemId: 'materiales/fosil', amount: 15 }, { itemId: 'materiales/mineral-elemental', amount: 12 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 10 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-solar-real', cost: 120, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 12 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 8 }, { itemId: 'materiales/roca-volcanica', amount: 8 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-prisma-antiguo', cost: 120, inputs: [{ itemId: 'materiales/mineral-elemental', amount: 12 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 14 }, { itemId: 'materiales/barra-de-oro-acero', amount: 10 }] }),
    makeRecipe({ itemId: 'mascotas/huevo-cometa', cost: 120, inputs: [{ itemId: 'materiales/fosil', amount: 12 }, { itemId: 'materiales/dulce-festivo', amount: 8 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 12 }] }),

    // --- Mejoras ---
    makeRecipe({ itemId: 'mejoras/potenciador-de-fortuna', cost: 50, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 4 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 6 }, { itemId: 'materiales/barra-de-oro-acero', amount: 2 }] }),
    makeRecipe({ itemId: 'mejoras/escudo-de-tolerancia', cost: 50, inputs: [{ itemId: 'materiales/roca-volcanica', amount: 8 }, { itemId: 'materiales/barra-de-oro-acero', amount: 4 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),
    makeRecipe({ itemId: 'mejoras/expansion-de-mochila', cost: 50, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 6 }, { itemId: 'materiales/mineral-elemental', amount: 6 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),
    makeRecipe({ itemId: 'mejoras/entrenamiento-moxi', cost: 50, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 4 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 4 }, { itemId: 'materiales/hierba-prisma', amount: 4 }] }),
    makeRecipe({ itemId: 'mejoras/trabajo-en-equipo', cost: 50, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 5 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 4 }, { itemId: 'materiales/barra-de-oro-acero', amount: 2 }] }),
    makeRecipe({ itemId: 'mejoras/estrella-de-suerte', cost: 50, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 3 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 7 }, { itemId: 'materiales/mineral-elemental', amount: 2 }] }),
    makeRecipe({ itemId: 'mejoras/aurora-festiva', cost: 50, inputs: [{ itemId: 'materiales/fosil', amount: 6 }, { itemId: 'materiales/dulce-festivo', amount: 6 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 3 }] }),
    makeRecipe({ itemId: 'mejoras/tinte-personalizado', cost: 50, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 4 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 4 }, { itemId: 'materiales/barra-de-oro-acero', amount: 3 }] }),

    // --- Misiones ---
    makeRecipe({ itemId: 'misiones/gema-prisma', cost: 75, inputs: [{ itemId: 'materiales/mineral-elemental', amount: 8 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 8 }, { itemId: 'materiales/flor-de-amor', amount: 2 }] }),
    makeRecipe({ itemId: 'misiones/conejo-de-peluche', cost: 75, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 6 }, { itemId: 'materiales/flor-de-amor', amount: 6 }] }),
    makeRecipe({ itemId: 'misiones/espada-de-hielo', cost: 75, inputs: [{ itemId: 'materiales/fosil', amount: 8 }, { itemId: 'materiales/barra-de-oro-acero', amount: 6 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 4 }] }),
    makeRecipe({ itemId: 'misiones/katana-solar', cost: 75, inputs: [{ itemId: 'materiales/barra-de-oro-acero', amount: 8 }, { itemId: 'materiales/mineral-elemental', amount: 6 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 6 }] }),
    makeRecipe({ itemId: 'misiones/mascara-de-zorro', cost: 75, inputs: [{ itemId: 'materiales/flor-de-amor', amount: 4 }, { itemId: 'materiales/fosil', amount: 6 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 5 }] }),

    // --- Pociones ---
    makeRecipe({ itemId: 'pociones/pocion-de-regeneracion', cost: 10, inputs: [{ itemId: 'materiales/hierba-prisma', amount: 3 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }, { itemId: 'materiales/flor-de-amor', amount: 1 }] }),
    makeRecipe({ itemId: 'pociones/pocion-de-resistencia', cost: 10, inputs: [{ itemId: 'materiales/roca-volcanica', amount: 3 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 1 }, { itemId: 'materiales/barra-de-oro-acero', amount: 1 }] }),
    makeRecipe({ itemId: 'pociones/pocion-del-explorador', cost: 10, inputs: [{ itemId: 'materiales/fosil', amount: 3 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }, { itemId: 'materiales/hierba-prisma', amount: 1 }] }),
    makeRecipe({ itemId: 'pociones/elixir-prisma', cost: 10, inputs: [{ itemId: 'materiales/fragmento-de-espiritu', amount: 3 }, { itemId: 'materiales/mineral-elemental', amount: 2 }, { itemId: 'materiales/flor-de-amor', amount: 1 }] }),
    makeRecipe({ itemId: 'pociones/huevito-de-energia-exploracion-regeneracion-resistencia', cost: 10, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 3 }, { itemId: 'materiales/hierba-prisma', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }] }),

    // --- Rollos ---
    makeRecipe({ itemId: 'rollos/rollo-moxi', cost: 25, inputs: [{ itemId: 'materiales/dulce-festivo', amount: 2 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }, { itemId: 'materiales/hierba-prisma', amount: 1 }] }),
    makeRecipe({ itemId: 'rollos/rollo-de-estrategia', cost: 25, inputs: [{ itemId: 'materiales/fosil', amount: 3 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 2 }, { itemId: 'materiales/barra-de-oro-acero', amount: 1 }] }),
    makeRecipe({ itemId: 'rollos/notas-del-explorador', cost: 25, inputs: [{ itemId: 'materiales/fosil', amount: 4 }, { itemId: 'materiales/hierba-prisma', amount: 2 }] }),
    makeRecipe({ itemId: 'rollos/papiro-jeroglifico', cost: 25, inputs: [{ itemId: 'materiales/fosil', amount: 5 }, { itemId: 'materiales/fragmento-de-espiritu', amount: 3 }] }),

    // --- Protección ---
    makeRecipe({
        itemId: 'proteccion/vida-extra',
        cost: 150,
        inputs: [
            { itemId: 'materiales/fragmento-de-espiritu', amount: 20 },
            { itemId: 'materiales/mineral-elemental', amount: 10 },
            { itemId: 'materiales/barra-de-oro-acero', amount: 10 },
            { itemId: 'materiales/flor-de-amor', amount: 5 },
        ],
    }),
]);

function validateRecipes() {
    for (const r of RECIPES) {
        assertValidItemId(r.output.itemId);
        for (const inp of r.inputs) {
            assertValidItemId(inp.itemId);
        }
    }
}

function listRecipes() {
    return RECIPES.slice();
}

function getDisplayNameForItem(itemId, lang) {
    const item = getItemById(itemId, { lang });
    return item?.name || itemId;
}

function getRecipeDisplayName(recipe, lang) {
    return getDisplayNameForItem(recipe?.output?.itemId, lang);
}

function resolveRecipe(query, lang) {
    const raw = String(query || '').trim();
    if (!raw) return null;

    // Por número (ID visual): 1..N según el orden de RECIPES
    if (/^\d+$/.test(raw)) {
        const idx = Number.parseInt(raw, 10) - 1;
        if (Number.isFinite(idx) && idx >= 0 && idx < RECIPES.length) {
            return RECIPES[idx];
        }
    }

    // itemId exact
    const byId = RECIPES.find(r => String(r.id) === raw || String(r.output?.itemId) === raw);
    if (byId) return byId;

    const q = normalizeText(raw);
    if (!q) return null;

    // by item name
    const byName = RECIPES.find(r => normalizeText(getRecipeDisplayName(r, lang)) === q);
    if (byName) return byName;

    // contains
    return RECIPES.find(r => normalizeText(getRecipeDisplayName(r, lang)).includes(q)) || null;
}

function getInvAmount(economyDoc, itemId) {
    const inv = Array.isArray(economyDoc?.inventory) ? economyDoc.inventory : [];
    const row = inv.find(x => x && x.itemId === itemId);
    return row ? Math.max(0, safeInt(row.amount, 0)) : 0;
}

function getMissingInputs(economyDoc, recipe) {
    const miss = [];
    for (const inp of recipe.inputs || []) {
        const have = getInvAmount(economyDoc, inp.itemId);
        const need = Math.max(1, safeInt(inp.amount, 1));
        if (have < need) miss.push({ itemId: inp.itemId, have, need });
    }
    return miss;
}

async function ensureEconomyUser(userId) {
    if (!process.env.MONGODB) {
        throw new Error('MongoDB no está configurado (MONGODB vacío).');
    }

    await ensureMongoConnection();
    const { Economy } = require('../Models/EconomySchema');

    try {
        await Economy.updateOne(
            { userId },
            { $setOnInsert: { userId, balance: 0, bank: 0, sakuras: 0, inventory: [] } },
            { upsert: true }
        );
    } catch (e) {
        if (e?.code !== 11000) throw e;
    }

    return Economy.findOne({ userId });
}

function addToInventory(eco, itemId, amount) {
    const qty = Math.max(1, safeInt(amount, 1));
    const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
    const row = inv.find(x => x && x.itemId === itemId);
    if (row) row.amount = safeInt(row.amount, 0) + qty;
    else inv.push({ itemId, amount: qty, obtainedAt: new Date() });
    eco.inventory = inv;
}

function consumeFromInventory(eco, itemId, amount) {
    const qty = Math.max(1, safeInt(amount, 1));
    const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
    const row = inv.find(x => x && x.itemId === itemId);
    const have = row ? Math.max(0, safeInt(row.amount, 0)) : 0;
    if (!row || have < qty) return false;

    row.amount = have - qty;
    if (row.amount <= 0) {
        eco.inventory = inv.filter(x => x && x.itemId !== itemId);
    } else {
        eco.inventory = inv;
    }
    return true;
}

async function craftRecipe({ userId, recipe }) {
    if (!recipe) return { ok: false, reason: 'no-recipe', message: 'Receta inválida.' };

    // Validar ids
    try {
        validateRecipes();
    } catch (e) {
        return { ok: false, reason: 'bad-recipes', message: e?.message || 'Recetas inválidas.' };
    }

    const eco = await ensureEconomyUser(userId);

    const cost = Math.max(0, safeInt(recipe?.cost, 0));
    if (cost > 0) {
        const bal = Math.max(0, safeInt(eco.balance, 0));
        if (bal < cost) {
            return {
                ok: false,
                reason: 'cost',
                cost,
                balance: bal,
                message: `Necesitas ${cost} 🪙 para craftear.`,
            };
        }
    }

    const missing = getMissingInputs(eco, recipe);
    if (missing.length) {
        return { ok: false, reason: 'missing', missing };
    }

    // consumir
    for (const inp of recipe.inputs || []) {
        const ok = consumeFromInventory(eco, inp.itemId, inp.amount);
        if (!ok) {
            return { ok: false, reason: 'race', message: 'No tienes suficientes materiales (se actualizaron). Intenta de nuevo.' };
        }
    }

    // dar output
    addToInventory(eco, recipe.output.itemId, recipe.output.amount);

    if (cost > 0) {
        eco.balance = Math.max(0, safeInt(eco.balance, 0) - cost);
    }
    await eco.save();

    return {
        ok: true,
        crafted: { itemId: recipe.output.itemId, amount: safeInt(recipe.output.amount, 1) },
    };
}

module.exports = {
    listRecipes,
    resolveRecipe,
    getRecipeDisplayName,
    getDisplayNameForItem,
    getMissingInputs,
    craftRecipe,
};
