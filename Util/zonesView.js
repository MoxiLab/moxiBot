const {
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');

const { Bot } = require('../Config');
const moxi = require('../i18n');
const { EMOJIS } = require('./emojis');
const { getItemById } = require('./inventoryCatalog');
const { FISH_ZONES } = require('./fishView');

const YEAR = new Date().getFullYear();
const BRAND_FOOTER = `© MoxiBot • ${YEAR}`;

function tZones(lang, key, vars = {}) {
    const fullKey = String(key || '').includes(':') ? String(key) : `economy/zones:${key}`;
    const res = moxi.translate(fullKey, lang, vars);
    if (!res) return '';

    const idx = fullKey.indexOf(':');
    const keyPath = (idx >= 0) ? fullKey.slice(idx + 1) : '';
    if (res === fullKey) return '';
    if (keyPath && res === keyPath) return '';

    // Si el valor es un placeholder tipo "__ui.page__" (o viene con variables detrás), no lo muestres.
    const firstToken = String(res).trim().split(/\s+/)[0] || '';
    if (firstToken.startsWith('__') && firstToken.endsWith('__')) return '';

    return res;
}

function zoneName({ kind, zone, lang }) {
    const k = normalizeKind(kind);
    const id = String(zone?.id || '').trim();
    const key = `economy/zones:${k}.${id}`;
    const res = moxi.translate(key, lang);
    if (res && res !== key) {
        const idx = key.indexOf(':');
        const keyPath = (idx >= 0) ? key.slice(idx + 1) : '';
        if (!keyPath || res !== keyPath) {
            const firstToken = String(res).trim().split(/\s+/)[0] || '';
            if (!(firstToken.startsWith('__') && firstToken.endsWith('__'))) {
                return res;
            }
        }
    }

    // Fallback: para fish no tenemos traducciones de nombres en economy/zones por defecto,
    // así que evitamos mostrar el nombre base (español) y usamos un label derivado del id.
    if (k === 'fish') {
        const pretty = id
            ? id
                .split('-')
                .filter(Boolean)
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')
            : '';
        return pretty || id || zone?.name || '—';
    }

    return zone?.name || id || '—';
}

const MINE_ZONES = Object.freeze([
    {
        id: 'cantera-prisma',
        name: 'Cantera Prisma',
        emoji: '⛏️',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['cantera'],
    },
    {
        id: 'cintas-cobre',
        name: 'Cintas de Cobre',
        emoji: '🧲',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['cobre', 'cintas'],
    },
    {
        id: 'minas-oxidadas',
        name: 'Minas Oxidadas',
        emoji: '⚙️',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['oxidadas'],
    },
    {
        id: 'tunel-magnetita',
        name: 'Túnel de Magnetita',
        emoji: '🧲',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['magnetita', 'tunel'],
    },
    {
        id: 'vetas-lunares',
        name: 'Vetas Lunares',
        emoji: '🌙',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['lunares', 'vetas'],
    },
    {
        id: 'mina-cristal',
        name: 'Mina de Cristal',
        emoji: '💎',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['cristal', 'mina'],
    },
    {
        id: 'cavernas-cuarzo',
        name: 'Cavernas de Cuarzo',
        emoji: '🔮',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['cuarzo', 'cavernas'],
    },
    {
        id: 'nodo-onice',
        name: 'Nodo de Ónice',
        emoji: '🖤',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['onice', 'ónice', 'nodo'],
    },
    {
        id: 'galeria-fracturada',
        name: 'Galería Fracturada',
        emoji: '🪨',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['fracturada', 'galeria'],
    },
    {
        id: 'camara-geoda',
        name: 'Cámara Geoda',
        emoji: '🟣',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['geoda', 'camara', 'cámara'],
    },
    {
        id: 'tajo-prohibido',
        name: 'Tajo Prohibido',
        emoji: '🚧',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['prohibido', 'tajo'],
    },
    {
        id: 'fosa-azufre',
        name: 'Fosa de Azufre',
        emoji: '🌋',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['azufre', 'fosa'],
    },
    {
        id: 'frente-obsidiana',
        name: 'Frente de Obsidiana',
        emoji: '🟫',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['obsidiana', 'frente'],
    },
    {
        id: 'abismo-basaltico',
        name: 'Abismo Basáltico',
        emoji: '⬛',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['basalto', 'basáltico', 'abismo'],
    },
    {
        id: 'extraccion-automatizada',
        name: 'Extracción Automatizada',
        emoji: '🤖',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['automatizada', 'golem'],
    },
    {
        id: 'refineria-subterranea',
        name: 'Refinería Subterránea',
        emoji: '🏭',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['refineria', 'refinería'],
    },
    {
        id: 'pozo-prisma',
        name: 'Pozo Prisma',
        emoji: '🌀',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['pozo'],
    },
    {
        id: 'nido-meteorita',
        name: 'Nido de Meteorita',
        emoji: '☄️',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['meteorita', 'nido'],
    },
    {
        id: 'cantera-ambar',
        name: 'Cantera de Ámbar',
        emoji: '🟠',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['ambar', 'ámbar'],
    },
    {
        id: 'veta-cobalto',
        name: 'Veta de Cobalto',
        emoji: '🔷',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['cobalto', 'veta'],
    },
    {
        id: 'cripta-estratos',
        name: 'Cripta de Estratos',
        emoji: '🗿',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['cripta', 'estratos'],
    },
    {
        id: 'catedral-estalactitas',
        name: 'Catedral de Estalactitas',
        emoji: '🧊',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['catedral', 'estalactitas'],
    },
    {
        id: 'sima-fulgurita',
        name: 'Sima de Fulgurita',
        emoji: '⚡',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['sima', 'fulgurita'],
    },
    {
        id: 'taller-robotico',
        name: 'Taller Robótico',
        emoji: '🦾',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['taller', 'robotico', 'robótico'],
    },
    {
        id: 'sala-derrumbe',
        name: 'Sala del Derrumbe',
        emoji: '🧱',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['derrumbe', 'sala'],
    },
    {
        id: 'camara-pirita',
        name: 'Cámara de Pirita',
        emoji: '✨',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['pirita', 'camara', 'cámara'],
    },
    {
        id: 'sima-ceniza',
        name: 'Sima de Ceniza',
        emoji: '🌫️',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['ceniza'],
    },
    {
        id: 'abismo-ferroso',
        name: 'Abismo Ferroso',
        emoji: '🪨',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['ferroso'],
    },
    {
        id: 'boveda-mineral',
        name: 'Bóveda Mineral',
        emoji: '🏦',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['boveda', 'bóveda'],
    },
    {
        id: 'anillo-geologico',
        name: 'Anillo Geológico',
        emoji: '🪐',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['anillo', 'geologico', 'geológico'],
    },
    {
        id: 'crater-mineral',
        name: 'Cráter Mineral',
        emoji: '☄️',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['crater', 'cráter'],
    },

    // Más zonas (pico prisma)
    {
        id: 'hondonada-esmeralda',
        name: 'Hondonada Esmeralda',
        emoji: '🟢',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['esmeralda', 'hondonada'],
    },
    {
        id: 'pasaje-de-granito',
        name: 'Pasaje de Granito',
        emoji: '🪨',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['granito', 'pasaje'],
    },
    {
        id: 'terrazas-de-malaquita',
        name: 'Terrazas de Malaquita',
        emoji: '🟩',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['malaquita', 'terrazas'],
    },
    {
        id: 'galeria-del-eco',
        name: 'Galería del Eco',
        emoji: '🔊',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['eco', 'galeria'],
    },
    {
        id: 'corte-ametista',
        name: 'Corte de Amatista',
        emoji: '🟣',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['amatista', 'corte'],
    },
    {
        id: 'pozos-salinos',
        name: 'Pozos Salinos',
        emoji: '🧂',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['sal', 'salinos', 'pozos'],
    },
    {
        id: 'estratos-piriticos',
        name: 'Estratos Piríticos',
        emoji: '✨',
        requiredItemId: 'herramientas/pico-prisma',
        aliases: ['piriticos', 'piríticos', 'estratos'],
    },

    // Más zonas (dinamita)
    {
        id: 'cascada-subterranea',
        name: 'Cascada Subterránea',
        emoji: '💧',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['cascada', 'subterranea', 'subterránea'],
    },
    {
        id: 'boveda-de-basaltos',
        name: 'Bóveda de Basaltos',
        emoji: '⬛',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['basaltos', 'boveda', 'bóveda'],
    },
    {
        id: 'santuario-de-obeliscos',
        name: 'Santuario de Obeliscos',
        emoji: '🗼',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['obeliscos', 'santuario'],
    },
    {
        id: 'corredor-de-lava-fria',
        name: 'Corredor de Lava Fría',
        emoji: '🧊',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['lava', 'fria', 'fría', 'corredor'],
    },
    {
        id: 'pozo-azabache',
        name: 'Pozo de Azabache',
        emoji: '🖤',
        requiredItemId: 'herramientas/dinamita',
        aliases: ['azabache', 'pozo'],
    },

    // Más zonas (gólem)
    {
        id: 'plataforma-industrial',
        name: 'Plataforma Industrial',
        emoji: '🏗️',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['plataforma', 'industrial'],
    },
    {
        id: 'cinta-transportadora',
        name: 'Cinta Transportadora',
        emoji: '📦',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['cinta', 'transportadora'],
    },
    {
        id: 'nucleo-de-extraccion',
        name: 'Núcleo de Extracción',
        emoji: '🧲',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['nucleo', 'núcleo', 'extraccion', 'extracción'],
    },
    {
        id: 'mecanismo-ancestral',
        name: 'Mecanismo Ancestral',
        emoji: '⚙️',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['mecanismo', 'ancestral'],
    },
    {
        id: 'taller-de-calibracion',
        name: 'Taller de Calibración',
        emoji: '🛠️',
        requiredItemId: 'herramientas/golem-minero-pescador',
        aliases: ['calibracion', 'calibración', 'taller'],
    },
]);

const BASE_EXPLORE_ZONES = [
    {
        id: 'sendero-antiguo',
        name: 'Sendero Antiguo',
        emoji: '🧭',
        requiredItemId: 'herramientas/llave-multiusos',
        aliases: ['sendero'],
    },
    {
        id: 'bosque-elemental',
        name: 'Bosque Elemental',
        emoji: '🌿',
        requiredItemId: 'herramientas/hacha-elemental',
        aliases: ['bosque'],
    },
    {
        id: 'ruinas-ocultas',
        name: 'Ruinas Ocultas',
        emoji: '🏛️',
        requiredItemId: 'herramientas/revelador-prisma',
        aliases: ['ocultas'],
    },
    {
        id: 'faros-solares',
        name: 'Faros Solares',
        emoji: '🔆',
        requiredItemId: 'herramientas/varita-solar',
        aliases: ['faros'],
    },
    {
        id: 'costa-perdida',
        name: 'Costa Perdida',
        emoji: '🏝️',
        requiredItemId: 'herramientas/barco-moxi',
        aliases: ['costa'],
    },
    {
        id: 'tunnel-sombras',
        name: 'Túnel de Sombras',
        emoji: '🕯️',
        requiredItemId: 'buffs/linterna-solar',
        aliases: ['sombras', 'tunel'],
    },

    // Más zonas (llave multiusos)
    {
        id: 'pasarela-oxidada',
        name: 'Pasarela Oxidada',
        emoji: '🧰',
        requiredItemId: 'herramientas/llave-multiusos',
        aliases: ['pasarela', 'oxidada'],
    },
    {
        id: 'muelle-abandonado',
        name: 'Muelle Abandonado',
        emoji: '⚓',
        requiredItemId: 'herramientas/llave-multiusos',
        aliases: ['muelle', 'abandonado'],
    },
    {
        id: 'bazar-oculto',
        name: 'Bazar Oculto',
        emoji: '🧿',
        requiredItemId: 'herramientas/llave-multiusos',
        aliases: ['bazar', 'oculto'],
    },

    // Más zonas (hacha elemental)
    {
        id: 'sotobosque-brillante',
        name: 'Sotobosque Brillante',
        emoji: '🍃',
        requiredItemId: 'herramientas/hacha-elemental',
        aliases: ['sotobosque', 'brillante'],
    },
    {
        id: 'arboleda-del-viento',
        name: 'Arboleda del Viento',
        emoji: '🌬️',
        requiredItemId: 'herramientas/hacha-elemental',
        aliases: ['arboleda', 'viento'],
    },

    // Más zonas (revelador prisma)
    {
        id: 'camaras-selladas',
        name: 'Cámaras Selladas',
        emoji: '🗝️',
        requiredItemId: 'herramientas/revelador-prisma',
        aliases: ['camaras', 'cámaras', 'selladas'],
    },
    {
        id: 'archivo-perdido',
        name: 'Archivo Perdido',
        emoji: '📜',
        requiredItemId: 'herramientas/revelador-prisma',
        aliases: ['archivo', 'perdido'],
    },

    // Más zonas (varita solar)
    {
        id: 'jardin-luminoso',
        name: 'Jardín Luminoso',
        emoji: '🌻',
        requiredItemId: 'herramientas/varita-solar',
        aliases: ['jardin', 'jardín', 'luminoso'],
    },
    {
        id: 'observatorio-claro',
        name: 'Observatorio Claro',
        emoji: '🔭',
        requiredItemId: 'herramientas/varita-solar',
        aliases: ['observatorio', 'claro'],
    },

    // Más zonas (barco moxi)
    {
        id: 'islas-albas',
        name: 'Islas Albas',
        emoji: '🏖️',
        requiredItemId: 'herramientas/barco-moxi',
        aliases: ['islas', 'albas'],
    },
    {
        id: 'archipielago-bruma',
        name: 'Archipiélago de Bruma',
        emoji: '🌫️',
        requiredItemId: 'herramientas/barco-moxi',
        aliases: ['archipielago', 'archipiélago', 'bruma'],
    },

    // Más zonas (linterna solar)
    {
        id: 'catacumbas-tenues',
        name: 'Catacumbas Tenues',
        emoji: '🕯️',
        requiredItemId: 'buffs/linterna-solar',
        aliases: ['catacumbas', 'tenues'],
    },
];

function makeZones(requiredItemId, entries) {
    const req = String(requiredItemId || '').trim();
    return (Array.isArray(entries) ? entries : []).map(([id, name, emoji, aliases]) => ({
        id,
        name,
        emoji,
        requiredItemId: req,
        aliases: Array.isArray(aliases) ? aliases : [],
    }));
}

const EXTRA_EXPLORE_ZONES = [
    ...makeZones('herramientas/llave-multiusos', [
        ['barrio-del-taller', 'Barrio del Taller', '🛠️', ['barrio', 'taller']],
        ['almacen-ferroviario', 'Almacén Ferroviario', '🚃', ['almacen', 'almacén', 'ferroviario']],
        ['puerta-del-candado', 'Puerta del Candado', '🔒', ['puerta', 'candado']],
        ['pasadizo-sin-luz', 'Pasadizo Sin Luz', '🕳️', ['pasadizo', 'sinluz']],
        ['muros-de-grafito', 'Muros de Grafito', '🖍️', ['muros', 'grafito']],
        ['pasillo-de-cajas', 'Pasillo de Cajas', '📦', ['pasillo', 'cajas']],
        ['torre-de-llaves', 'Torre de Llaves', '🗝️', ['torre', 'llaves']],
        ['muelle-de-sombras', 'Muelle de Sombras', '⚓', ['muelle', 'sombras']],
        ['puente-partido', 'Puente Partido', '🌉', ['puente', 'partido']],
        ['sala-de-mapas', 'Sala de Mapas', '🗺️', ['sala', 'mapas']],
    ]),

    ...makeZones('herramientas/hacha-elemental', [
        ['claro-del-rocio', 'Claro del Rocío', '💦', ['claro', 'rocio', 'rocío']],
        ['sendero-de-hongos', 'Sendero de Hongos', '🍄', ['sendero', 'hongos']],
        ['pinos-azules', 'Pinos Azules', '🌲', ['pinos', 'azules']],
        ['cascada-esmeralda', 'Cascada Esmeralda', '💧', ['cascada', 'esmeralda']],
        ['colina-florida', 'Colina Florida', '🌸', ['colina', 'florida']],
        ['bosque-de-bruma', 'Bosque de Bruma', '🌫️', ['bosque', 'bruma']],
        ['arbol-anciano', 'Árbol Anciano', '🌳', ['arbol', 'árbol', 'anciano']],
        ['jardin-silvestre', 'Jardín Silvestre', '🌿', ['jardin', 'jardín', 'silvestre']],
        ['anillo-de-brezo', 'Anillo de Brezo', '🪻', ['anillo', 'brezo']],
        ['finca-musgosa', 'Finca Musgosa', '🪴', ['finca', 'musgosa']],
    ]),

    ...makeZones('herramientas/revelador-prisma', [
        ['sala-de-artefactos', 'Sala de Artefactos', '📿', ['sala', 'artefactos']],
        ['cripta-de-mosaicos', 'Cripta de Mosaicos', '🧱', ['cripta', 'mosaicos']],
        ['camaras-del-reloj', 'Cámaras del Reloj', '⏱️', ['camaras', 'cámaras', 'reloj']],
        ['pasaje-prismatico', 'Pasaje Prismático', '🌈', ['pasaje', 'prismatico', 'prismático']],
        ['biblioteca-sumergida', 'Biblioteca Sumergida', '📚', ['biblioteca', 'sumergida']],
        ['laboratorio-antiguo', 'Laboratorio Antiguo', '⚗️', ['laboratorio', 'antiguo']],
        ['sello-de-piedra', 'Sello de Piedra', '🪨', ['sello', 'piedra']],
        ['altar-olvidado', 'Altar Olvidado', '🕯️', ['altar', 'olvidado']],
        ['salon-de-espejos', 'Salón de Espejos', '🪞', ['salon', 'salón', 'espejos']],
        ['camara-criptograma', 'Cámara Criptograma', '🔎', ['camara', 'cámara', 'criptograma']],
    ]),

    ...makeZones('herramientas/varita-solar', [
        ['mirador-del-amanecer', 'Mirador del Amanecer', '🌅', ['mirador', 'amanecer']],
        ['cumbre-dorada', 'Cumbre Dorada', '🏔️', ['cumbre', 'dorada']],
        ['patio-del-sol', 'Patio del Sol', '☀️', ['patio', 'sol']],
        ['plaza-luminaria', 'Plaza Luminaria', '💡', ['plaza', 'luminaria']],
        ['cristales-de-luz', 'Cristales de Luz', '🔆', ['cristales', 'luz']],
        ['valle-radiante', 'Valle Radiante', '✨', ['valle', 'radiante']],
        ['torre-helio', 'Torre Helio', '🗼', ['torre', 'helio']],
        ['sendero-solar', 'Sendero Solar', '🌞', ['sendero', 'solar']],
    ]),

    ...makeZones('herramientas/barco-moxi', [
        ['bahia-de-corales', 'Bahía de Corales', '🪸', ['bahia', 'bahía', 'corales']],
        ['costa-de-perlas', 'Costa de Perlas', '🦪', ['costa', 'perlas']],
        ['arrecife-brillante', 'Arrecife Brillante', '🐠', ['arrecife', 'brillante']],
        ['laguna-de-bruma', 'Laguna de Bruma', '🌫️', ['laguna', 'bruma']],
        ['isla-del-faro', 'Isla del Faro', '🗼', ['isla', 'faro']],
        ['puerto-olvidado', 'Puerto Olvidado', '🛳️', ['puerto', 'olvidado']],
        ['mar-de-vidrio', 'Mar de Vidrio', '🌊', ['mar', 'vidrio']],
    ]),

    ...makeZones('buffs/linterna-solar', [
        ['cripta-de-humedad', 'Cripta de Humedad', '💦', ['cripta', 'humedad']],
        ['galeria-de-susurros', 'Galería de Susurros', '👂', ['galeria', 'galería', 'susurros']],
        ['escaleras-invertidas', 'Escaleras Invertidas', '🌀', ['escaleras', 'invertidas']],
        ['sala-de-cera', 'Sala de Cera', '🕯️', ['sala', 'cera']],
        ['tuneles-laberinto', 'Túneles Laberinto', '🧩', ['tuneles', 'túneles', 'laberinto']],
        ['nicho-vigilante', 'Nicho Vigilante', '👁️', ['nicho', 'vigilante']],
        ['pasaje-de-bronce', 'Pasaje de Bronce', '🥉', ['pasaje', 'bronce']],
    ]),
];

const EXPLORE_ZONES = Object.freeze(
    [...BASE_EXPLORE_ZONES, ...EXTRA_EXPLORE_ZONES].map((z, idx) => {
        const existing = z && Object.prototype.hasOwnProperty.call(z, 'requiredPetLevel') ? Number(z.requiredPetLevel) : null;
        // Progresión de niveles “de 5 en 5” por bloques de 5 zonas:
        // idx 0–4 => nivel 1, idx 5–9 => nivel 6, idx 10–14 => nivel 11...
        const safeIdx = Math.max(0, Math.trunc(Number(idx) || 0));
        const auto = 1 + (Math.floor(safeIdx / 5) * 5);
        const requiredPetLevel = Number.isFinite(existing) ? Math.max(1, Math.trunc(existing)) : auto;
        return { ...z, requiredPetLevel };
    })
);

const ZONE_KINDS = Object.freeze({
    fish: { id: 'fish', label: 'Pesca', emoji: '🎣' },
    mine: { id: 'mine', label: 'Minería', emoji: '⛏️' },
    explore: { id: 'explore', label: 'Exploración', emoji: '🧭' },
});

function safeInt(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.trunc(x);
}

function clampInt(n, min, max) {
    const x = Number.parseInt(String(n), 10);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
}

function itemLabel(itemId, lang) {
    const item = getItemById(itemId, { lang });
    return item?.name ? `**${item.name}**` : `**${itemId}**`;
}

function normalizeKind(kind) {
    const k = String(kind || '').trim().toLowerCase();
    if (k === 'pesca' || k === 'fish') return 'fish';
    if (k === 'mineria' || k === 'mining' || k === 'mine') return 'mine';
    if (k === 'exploracion' || k === 'explore') return 'explore';
    return 'fish';
}

function getZonesForKind(kind) {
    const k = normalizeKind(kind);
    if (k === 'fish') return FISH_ZONES;
    if (k === 'mine') return MINE_ZONES;
    if (k === 'explore') return EXPLORE_ZONES;
    return FISH_ZONES;
}

function getZonesPage({ kind, page = 0, perPage = 5 } = {}) {
    const zones = getZonesForKind(kind);
    const safePerPage = Math.max(1, Math.min(5, safeInt(perPage, 5)));
    const totalPages = Math.max(1, Math.ceil(zones.length / safePerPage));
    const p = clampInt(page, 0, totalPages - 1);
    const start = p * safePerPage;
    const slice = zones.slice(start, start + safePerPage);
    return { zones, page: p, perPage: safePerPage, totalPages, slice };
}

function buildKindSelect({ lang = 'es-ES', userId, kind, page = 0, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const current = normalizeKind(kind);
    const p = clampInt(page, 0, 999);

    return new StringSelectMenuBuilder()
        .setCustomId(`zones:select:${safeUserId}:${current}:${p}`)
        .setPlaceholder(tZones(lang, 'ui.selectCategory') || 'Selecciona una categoría…')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(disabled)
        .addOptions(
            {
                label: tZones(lang, 'kinds.fish') || 'Pesca',
                value: 'fish',
                emoji: ZONE_KINDS.fish.emoji,
                default: current === 'fish',
            },
            {
                label: tZones(lang, 'kinds.mine') || 'Minería',
                value: 'mine',
                emoji: ZONE_KINDS.mine.emoji,
                default: current === 'mine',
            },
            {
                label: tZones(lang, 'kinds.explore') || 'Exploración',
                value: 'explore',
                emoji: ZONE_KINDS.explore.emoji,
                default: current === 'explore',
            }
        );
}

function buildNavButtons({ userId, kind, page, totalPages, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const k = normalizeKind(kind);
    const p = clampInt(page, 0, Math.max(0, (totalPages || 1) - 1));

    const prev = new ButtonBuilder()
        .setCustomId(`zones:prev:${safeUserId}:${k}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.arrowLeft)
        .setDisabled(disabled || p <= 0);

    const refresh = new ButtonBuilder()
        .setCustomId(`zones:refresh:${safeUserId}:${k}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔁')
        .setDisabled(disabled);

    const close = new ButtonBuilder()
        .setCustomId(`zones:close:${safeUserId}:${k}:${p}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji(EMOJIS.cross)
        .setDisabled(disabled);

    const help = new ButtonBuilder()
        .setCustomId(`zones:help:${safeUserId}:${k}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.question)
        .setDisabled(disabled);

    const next = new ButtonBuilder()
        .setCustomId(`zones:next:${safeUserId}:${k}:${p}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJIS.arrowRight)
        .setDisabled(disabled || p >= (totalPages - 1));

    return [prev, refresh, close, help, next];
}

function buildPickButtons({ userId, kind, page, slice, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const k = normalizeKind(kind);
    const p = clampInt(page, 0, 999);
    const zones = Array.isArray(slice) ? slice : [];

    return zones.map((z, index) =>
        new ButtonBuilder()
            .setCustomId(`zones:pick:${safeUserId}:${k}:${p}:${index}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(z?.emoji || '📍')
            .setLabel(String(z?.id || `zona-${index + 1}`))
            .setDisabled(disabled)
    );
}

function buildZonesContainer({ lang = 'es-ES', userId, kind = 'fish', page = 0, perPage = 5, disabledButtons = false } = {}) {
    const k = normalizeKind(kind);
    const kindInfo = ZONE_KINDS[k] || ZONE_KINDS.fish;
    const kindLabel = tZones(lang, `kinds.${k}`) || kindInfo.label;

    const { page: p, totalPages, slice, zones } = getZonesPage({ kind: k, page, perPage });

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(t => t.setContent(tZones(lang, 'ui.page', { page: p + 1, total: totalPages }) || `Página ${p + 1} de ${totalPages}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => {
            if (k === 'fish') return t.setContent(tZones(lang, 'ui.fishTitle') || '## Fish • Zonas');
            return t.setContent(tZones(lang, 'ui.kindTitle', { icon: kindInfo.emoji, label: kindLabel }) || `## ${kindInfo.emoji} Zonas • ${kindLabel}`);
        });

    if (k === 'fish') {
        container
            .addTextDisplayComponents(t => t.setContent(tZones(lang, 'ui.availableFish', { count: zones.length }) || `Zonas de pesca disponibles: **${zones.length}**`))
            .addSeparatorComponents(s => s.setDivider(true));
    }

    if (k === 'mine') {
        container
            .addTextDisplayComponents(t => t.setContent(tZones(lang, 'ui.availableMine', { count: zones.length }) || `Zonas de minería disponibles: **${zones.length}**`))
            .addSeparatorComponents(s => s.setDivider(true));
    }

    if (k === 'explore') {
        container
            .addTextDisplayComponents(t => t.setContent(tZones(lang, 'ui.availableExplore', { count: zones.length }) || `Zonas de exploración disponibles: **${zones.length}**`))
            .addSeparatorComponents(s => s.setDivider(true));
    }

    if (!zones.length) {
        container.addTextDisplayComponents(t => t.setContent('Próximamente…\nPor ahora solo está disponible **Pesca**.'));
    } else {
        for (const z of slice) {
            const requiredLabel = tZones(lang, 'ui.requires', { item: itemLabel(z.requiredItemId, lang) }) || `Requiere: ${itemLabel(z.requiredItemId, lang)}`;
            container
                .addTextDisplayComponents(t =>
                    t.setContent(
                        `${z.emoji || '📍'} **${z.id}** — ${zoneName({ kind: k, zone: z, lang })}\n` +
                        requiredLabel
                    )
                )
                .addSeparatorComponents(s => s.setDivider(true));
        }

        container.addTextDisplayComponents(t => {
            if (k === 'fish') return t.setContent(tZones(lang, 'ui.pickHintFish') || 'Pulsa un botón de zona para pescar.');
            return t.setContent(tZones(lang, 'ui.pickHintOther') || 'Pulsa una zona para hacer la acción.');
        });
    }

    // Row 1: botones de acción por zona (solo si hay zonas)
    if (zones.length) {
        container.addActionRowComponents(row => row.addComponents(
            ...buildPickButtons({ userId, kind: k, page: p, slice, disabled: disabledButtons })
        ));
    }

    // Row 2: navegación
    container.addActionRowComponents(row => row.addComponents(
        ...buildNavButtons({ userId, kind: k, page: p, totalPages, disabled: disabledButtons })
    ));

    // Row 3: select debajo de los botones
    container.addActionRowComponents(row => row.addComponents(
        buildKindSelect({ lang, userId, kind: k, page: p, disabled: disabledButtons })
    ));

    // Footer (paginación) debajo del select
    container
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(`${BRAND_FOOTER}`));

    return { container, kind: k, page: p, totalPages, slice };
}

function buildZonesMessageOptions({ lang = 'es-ES', userId, kind = 'fish', page = 0, perPage } = {}) {
    const { container } = buildZonesContainer({ lang, userId, kind, page, perPage });
    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function parseZonesCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('zones:')) return null;

    const parts = raw.split(':');
    // zones:action:userId:kind:page(:index)
    const action = parts[1] || null;
    const userId = parts[2] || null;
    const kind = parts[3] || null;
    const page = parts[4] || '0';
    const index = parts[5];

    if (!action || !userId || !kind) return null;

    return {
        action,
        userId,
        kind: normalizeKind(kind),
        page: Number.parseInt(page, 10) || 0,
        index: index !== undefined ? Number.parseInt(index, 10) : null,
    };
}

function getZoneForPick({ kind, page, index, perPage = 5 } = {}) {
    const { zones, page: p } = getZonesPage({ kind, page, perPage });
    const start = p * Math.max(1, Math.min(5, safeInt(perPage, 5)));
    const i = clampInt(index, 0, 4);
    return zones[start + i] || null;
}

module.exports = {
    MINE_ZONES,
    EXPLORE_ZONES,
    ZONE_KINDS,
    normalizeKind,
    zoneName,
    getZonesForKind,
    buildZonesContainer,
    buildZonesMessageOptions,
    parseZonesCustomId,
    getZoneForPick,
};
