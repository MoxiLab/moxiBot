const { randInt } = require('./activityUtils');

function clamp(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
}

function makeButtonsOptions(tier) {
    // tier 0..n: a más tier, más recompensa/pena y menos probabilidad
    const t = Math.max(0, Math.trunc(Number(tier) || 0));
    const base = 55 + t * 4;
    const fineBase = 20 + t * 2;
    const pStealth = clamp(0.70 - t * 0.004, 0.35, 0.80);
    const pTalk = clamp(0.64 - t * 0.0045, 0.30, 0.78);
    const pRush = clamp(0.54 - t * 0.005, 0.25, 0.74);

    return [
        { id: 'stealth', label: 'Sigilo', emoji: '🕶️', successChance: pStealth, reward: { min: base, max: base + 120 + t * 6 }, fine: { min: fineBase, max: fineBase + 70 + t * 3 } },
        { id: 'talk', label: 'Distracción', emoji: '🗣️', successChance: pTalk, reward: { min: base + 15, max: base + 160 + t * 7 }, fine: { min: fineBase + 5, max: fineBase + 90 + t * 4 } },
        { id: 'rush', label: 'Arrebato', emoji: '🏃', successChance: pRush, reward: { min: base + 40, max: base + 240 + t * 10 }, fine: { min: fineBase + 15, max: fineBase + 125 + t * 5 } },
    ];
}

function makeDoorsActivity({ id, emoji, title, prompt, tier }) {
    const t = Math.max(0, Math.trunc(Number(tier) || 0));
    return {
        id,
        emoji,
        title,
        prompt,
        kind: 'doors',
        doors: [
            { id: 'a', label: 'Puerta A', emoji: '🅰️' },
            { id: 'b', label: 'Puerta B', emoji: '🅱️' },
            { id: 'c', label: 'Puerta C', emoji: '🆑' },
        ],
        reward: { min: 80 + t * 6, max: 260 + t * 14 },
        fine: { min: 30 + t * 3, max: 140 + t * 8 },
    };
}

function makeRiskActivity({ id, emoji, title, prompt, tier }) {
    const t = Math.max(0, Math.trunc(Number(tier) || 0));
    const bump = t * 4;
    return {
        id,
        emoji,
        title,
        prompt,
        kind: 'risk',
        risks: [
            { id: 'safe', label: 'Seguro', emoji: '🟢', successChance: clamp(0.80 - t * 0.003, 0.45, 0.85), reward: { min: 45 + bump, max: 130 + bump * 2 }, fine: { min: 15 + t, max: 70 + bump } },
            { id: 'normal', label: 'Normal', emoji: '🟡', successChance: clamp(0.64 - t * 0.004, 0.35, 0.78), reward: { min: 70 + bump * 2, max: 210 + bump * 3 }, fine: { min: 25 + t * 2, max: 115 + bump * 2 } },
            { id: 'risky', label: 'Arriesgado', emoji: '🔴', successChance: clamp(0.50 - t * 0.0045, 0.20, 0.72), reward: { min: 110 + bump * 3, max: 320 + bump * 4 }, fine: { min: 35 + t * 3, max: 170 + bump * 3 } },
        ],
    };
}

function makeWiresActivity({ id, emoji, title, prompt, tier }) {
    const t = Math.max(0, Math.trunc(Number(tier) || 0));
    return {
        id,
        emoji,
        title,
        prompt,
        kind: 'wires',
        wires: [
            { id: 'red', emoji: '🔴' },
            { id: 'blue', emoji: '🔵' },
            { id: 'yellow', emoji: '🟡' },
            { id: 'green', emoji: '🟢' },
        ],
        // Determinista por seed (no por probabilidad): el premio/pena escala con tier
        reward: { min: 70 + t * 6, max: 240 + t * 14 },
        fine: { min: 25 + t * 3, max: 130 + t * 9 },
    };
}

function buildGeneratedCrimeActivities() {
    // Importante: los IDs NO pueden contener ':' porque los customId se parsean con split(':')
    const buttonScenes = [
        { id: 'pickpocket', emoji: '🧤', title: 'Carterista', prompt: 'Ves a alguien distraído con la bolsa abierta. ¿Cómo lo intentas?' },
        { id: 'market-swipe', emoji: '🛍️', title: 'Mercado abarrotado', prompt: 'Entre puestos y gente, una cartera asoma. ¿Cómo actúas?' },
        { id: 'metro-bump', emoji: '🚇', title: 'Empujón en el metro', prompt: 'Un frenazo, cuerpos chocan… y un bolsillo fácil aparece.' },
        { id: 'festival-confetti', emoji: '🎉', title: 'Festival', prompt: 'Música, confeti y distracciones. ¿Cuál es tu jugada?' },
        { id: 'hotel-lobby', emoji: '🏨', title: 'Lobby de hotel', prompt: 'La gente baja la guardia. ¿Cómo lo intentas?' },
        { id: 'arcade-tokens', emoji: '🕹️', title: 'Salón recreativo', prompt: 'Alguien cuenta fichas. Te mira nadie. ¿Qué haces?' },
        { id: 'library-silence', emoji: '📚', title: 'Biblioteca', prompt: 'Silencio total. Un bolso abierto. ¿Qué método usas?' },
        { id: 'park-bench', emoji: '🌳', title: 'Banco del parque', prompt: 'Una mochila queda a un lado. ¿Cómo te acercas?' },
        { id: 'street-magician', emoji: '🎩', title: 'Mago callejero', prompt: 'Todos miran al truco. Tú miras a los bolsillos.' },
        { id: 'coffee-queue', emoji: '☕', title: 'Cola del café', prompt: 'La cola avanza lento. La atención, baja.' },
        { id: 'cinema-dark', emoji: '🎬', title: 'Cine oscuro', prompt: 'Luces fuera. ¿Aprovechas el momento?' },
        { id: 'museum-exhibit', emoji: '🖼️', title: 'Museo', prompt: 'La gente se queda hipnotizada ante una vitrina.' },
        { id: 'food-truck', emoji: '🌮', title: 'Food truck', prompt: 'Monederos al aire y prisas por pagar.' },
        { id: 'crosswalk-rush', emoji: '🚦', title: 'Cruce concurrido', prompt: 'Semáforo en verde. Caos controlado.' },
        { id: 'gym-lockers', emoji: '🏋️', title: 'Taquillas del gym', prompt: 'Candados flojos y gente despistada.' },
        { id: 'pier-crowd', emoji: '🛟', title: 'Muelle', prompt: 'Turistas con mochilas y mapas abiertos.' },
        { id: 'station-platform', emoji: '🚉', title: 'Andén', prompt: 'Llega el tren. Nervios. Oportunidad.' },
        { id: 'night-market', emoji: '🏮', title: 'Mercado nocturno', prompt: 'Luces cálidas. Manos rápidas.' },
        { id: 'street-performer', emoji: '🥁', title: 'Percusionista', prompt: 'El ritmo tapa pasos y susurros.' },
        { id: 'salon-wait', emoji: '💇', title: 'Sala de espera', prompt: 'Teléfonos fuera. Carteras fuera. Hmm.' },
        { id: 'bank-atm', emoji: '🏧', title: 'Cajero', prompt: 'Alguien saca dinero y guarda el recibo.' },
        { id: 'taxi-backseat', emoji: '🚕', title: 'Taxi', prompt: 'Una cartera cae al asiento trasero.' },
        { id: 'train-sleeper', emoji: '🛌', title: 'Vagón dormido', prompt: 'Cabezas caídas, bolsillos sin guardia.' },
        { id: 'snow-coats', emoji: '🧣', title: 'Abrigos de invierno', prompt: 'Los bolsillos son profundos… y tentadores.' },
        { id: 'rain-umbrella', emoji: '☔', title: 'Día de lluvia', prompt: 'Paraguas chocan. Nadie ve nada.' },
        { id: 'beach-towels', emoji: '🏖️', title: 'Playa', prompt: 'Toallas, bolsos, despistes. ¿Qué haces?' },
        { id: 'concert-mosh', emoji: '🎵', title: 'Concierto', prompt: 'La masa se mueve. Tú también.' },
        { id: 'market-auction', emoji: '🔨', title: 'Subasta', prompt: 'Pujas altas. Atención dispersa.' },
        { id: 'fashion-store', emoji: '👗', title: 'Tienda de moda', prompt: 'Probadores ocupados. Personal distraído.' },
        { id: 'electronics-demo', emoji: '📱', title: 'Demo de gadgets', prompt: 'Pantallas brillantes. Bolsillos brillantes.' },
        { id: 'pet-parade', emoji: '🐾', title: 'Desfile de mascotas', prompt: 'La gente mira perritos. Tú… bueno.' },
        { id: 'street-food', emoji: '🍜', title: 'Comida callejera', prompt: 'Manos llenas, bolsillos sin vigilar.' },
        { id: 'bus-crowd', emoji: '🚌', title: 'Bus lleno', prompt: 'Paradas rápidas. Movimientos rápidos.' },
        { id: 'book-fair', emoji: '📖', title: 'Feria del libro', prompt: 'Firmas, colas y distracciones perfectas.' },
        { id: 'flower-stall', emoji: '💐', title: 'Puesto de flores', prompt: 'Un regalo romántico. Una cartera visible.' },
        { id: 'campus-hall', emoji: '🎓', title: 'Pasillo del campus', prompt: 'Mochilas abiertas y prisas por clase.' },
        { id: 'airport-gate', emoji: '🛫', title: 'Puerta de embarque', prompt: 'Documentos, billetes, caos. Fácil.' },
        { id: 'theme-park', emoji: '🎢', title: 'Parque temático', prompt: 'Gritos, risas y bolsos colgando.' },
        { id: 'harbor-ferry', emoji: '⛴️', title: 'Ferry', prompt: 'Viento, mareo… y un despiste.' },
        { id: 'stadium-queue', emoji: '🏟️', title: 'Cola del estadio', prompt: 'Todo el mundo mira la entrada. Bolsillos, no tanto.' },
    ];

    const doorScenes = [
        { id: 'vault', emoji: '🚪', title: 'Tres puertas', prompt: 'Estás dentro. Hay tres puertas. Una tiene un botín rápido; las otras, problemas.' },
        { id: 'storage-doors', emoji: '📦', title: 'Almacén', prompt: 'Tres puertas de chapa. Una guarda caja fácil. Elige.' },
        { id: 'office-doors', emoji: '🏢', title: 'Oficinas', prompt: 'Pasillo vacío. Tres puertas sin cartel. ¿Cuál abre el premio?' },
        { id: 'basement-doors', emoji: '🕳️', title: 'Sótano', prompt: 'Humedad y silencio. Tres puertas: ruido, calma, suerte.' },
        { id: 'backstage-doors', emoji: '🎭', title: 'Backstage', prompt: 'Tras el escenario hay tres accesos. Uno lleva al botín.' },
        { id: 'dock-doors', emoji: '⚓', title: 'Muelles', prompt: 'Contenedores y tres puertas de almacén. Elige rápido.' },
        { id: 'subway-doors', emoji: '🚇', title: 'Túnel', prompt: 'Tres puertas de mantenimiento. Una tiene provisiones.' },
        { id: 'library-doors', emoji: '📚', title: 'Archivo', prompt: 'Tres puertas al archivo restringido. Una tiene sobres.' },
        { id: 'casino-doors', emoji: '🎰', title: 'Casino', prompt: 'Tres puertas tras la sala VIP. Una es la buena.' },
        { id: 'hotel-doors', emoji: '🏨', title: 'Planta privada', prompt: 'Tres puertas iguales. Una no está cerrada del todo.' },
        { id: 'museum-doors', emoji: '🖼️', title: 'Zona restringida', prompt: 'Tres puertas con alarmas dudosas. Una falla.' },
        { id: 'trainyard-doors', emoji: '🚂', title: 'Depósito', prompt: 'Tres puertas oxidadas. Una abre con facilidad.' },
        { id: 'lab-doors', emoji: '🧪', title: 'Laboratorio', prompt: 'Tres puertas con paneles. Una está en modo test.' },
        { id: 'sewers-doors', emoji: '🕳️', title: 'Cloacas', prompt: 'Tres compuertas. Una lleva a un escondite.' },
        { id: 'attic-doors', emoji: '🏚️', title: 'Ático', prompt: 'Tres puertas viejas. Una cruje… pero cede.' },
        { id: 'theater-doors', emoji: '🎟️', title: 'Teatro', prompt: 'Tres puertas tras bambalinas. Una tiene taquilla.' },
        { id: 'warehouse-doors', emoji: '🏭', title: 'Nave industrial', prompt: 'Tres puertas numeradas a mano. Una guarda lo bueno.' },
        { id: 'ship-doors', emoji: '🛳️', title: 'Bodega del barco', prompt: 'Tres puertas a la bodega. Elige antes de que vuelva alguien.' },
        { id: 'castle-doors', emoji: '🏰', title: 'Pasaje', prompt: 'Tres puertas de piedra. Una es atajo al tesoro.' },
        { id: 'clinic-doors', emoji: '🏥', title: 'Clínica', prompt: 'Tres puertas de almacén. Una tiene caja fuerte pequeña.' },
        { id: 'stadium-doors', emoji: '🏟️', title: 'Estadio', prompt: 'Tres puertas a vestuarios. Una guarda objetos perdidos.' },
        { id: 'mall-doors', emoji: '🏬', title: 'Centro comercial', prompt: 'Tres puertas de servicio. Una conduce a la caja.' },
        { id: 'garage-doors', emoji: '🚗', title: 'Garaje', prompt: 'Tres puertas metálicas. Una no tiene candado.' },
        { id: 'serverroom-doors', emoji: '🖥️', title: 'Sala de servidores', prompt: 'Tres puertas. Una tiene equipos revendibles.' },
        { id: 'kitchen-doors', emoji: '🍳', title: 'Cocina', prompt: 'Tres puertas al almacén. Una tiene suministros caros.' },
        { id: 'bakery-doors', emoji: '🥐', title: 'Panadería', prompt: 'Tres puertas traseras. Una lleva a la caja.' },
        { id: 'gallery-doors', emoji: '🖼️', title: 'Galería', prompt: 'Tres puertas a la trastienda. Una está mal cerrada.' },
        { id: 'station-doors', emoji: '🚉', title: 'Estación', prompt: 'Tres puertas de limpieza. Una oculta una bolsa.' },
        { id: 'factory-doors', emoji: '🏭', title: 'Fábrica', prompt: 'Tres puertas. Una abre hacia un almacén con piezas.' },
        { id: 'dockyard-doors', emoji: '🧰', title: 'Astillero', prompt: 'Tres puertas de herramientas. Una tiene cajas nuevas.' },
    ];

    const riskScenes = [
        { id: 'getaway', emoji: '🛵', title: 'Huida', prompt: 'Tienes el botín en la mano. ¿Qué nivel de riesgo tomas para escapar?' },
        { id: 'alley-chase', emoji: '🏃', title: 'Callejón', prompt: 'Pasos detrás. Sirenas lejos. ¿Cómo escapas?' },
        { id: 'rooftops', emoji: '🏙️', title: 'Azoteas', prompt: 'Subes escaleras de incendio. ¿Cuánto arriesgas?' },
        { id: 'crowd-vanish', emoji: '🧍', title: 'Perderse en la gente', prompt: 'La multitud puede salvarte… o delatarte.' },
        { id: 'river-cross', emoji: '🌊', title: 'Cruzar el río', prompt: 'Hay un puente, una barca y un salto. ¿Riesgo?' },
        { id: 'night-scooter', emoji: '🛵', title: 'Scooter nocturno', prompt: 'La noche es aliada. O enemiga. Decide.' },
        { id: 'smoke-bomb', emoji: '💨', title: 'Cortina de humo', prompt: 'Puedes desaparecer… si te sale bien.' },
        { id: 'subway-hop', emoji: '🚇', title: 'Salto al metro', prompt: 'El metro llega. ¿Te cuelas a lo loco o con calma?' },
        { id: 'taxi-dash', emoji: '🚕', title: 'Taxi rápido', prompt: 'Un taxi libre. ¿Pagas y te vas o sales pitando?' },
        { id: 'crowbar-route', emoji: '🧰', title: 'Ruta de emergencia', prompt: 'Hay puertas cerradas. Puedes forzar una.' },
        { id: 'rain-cover', emoji: '☔', title: 'Lluvia', prompt: 'La lluvia tapa huellas… también visión.' },
        { id: 'market-escape', emoji: '🏮', title: 'Escape en mercado', prompt: 'Entre puestos estrechos, un error cuesta caro.' },
        { id: 'stairs-sprint', emoji: '🧗', title: 'Escaleras', prompt: 'Subes o bajas. Cada segundo cuenta.' },
        { id: 'bus-hop', emoji: '🚌', title: 'Subir al bus', prompt: 'El bus arranca en 5s. ¿Te lanzas?' },
        { id: 'bike-lane', emoji: '🚲', title: 'Carril bici', prompt: 'Una bici suelta. ¿La tomas?' },
        { id: 'dock-fog', emoji: '🌫️', title: 'Niebla en el muelle', prompt: 'La niebla oculta… pero también confunde.' },
        { id: 'warehouse-run', emoji: '🏭', title: 'Correr entre naves', prompt: 'Atajos por dentro. Riesgo de guardias.' },
        { id: 'festival-hide', emoji: '🎉', title: 'Esconderse en festival', prompt: 'Disfraces y máscaras. ¿Cuánto te expones?' },
        { id: 'parking-garage', emoji: '🅿️', title: 'Parking', prompt: 'Rampas, coches, cámaras. Decide nivel de riesgo.' },
        { id: 'canal-walk', emoji: '🛶', title: 'Canal', prompt: 'Puedes bordear el canal. Resbala.' },
        { id: 'construction-site', emoji: '🏗️', title: 'Obra', prompt: 'Andamios y huecos. Puedes perderte… o caer.' },
        { id: 'mall-exit', emoji: '🏬', title: 'Salida del centro comercial', prompt: 'Tres salidas, dos guardias. ¿Qué haces?' },
        { id: 'hotel-elevator', emoji: '🛗', title: 'Ascensor', prompt: 'Ascensor lento o escaleras rápidas. Riesgo.' },
        { id: 'station-cameras', emoji: '📷', title: 'Cámaras', prompt: 'Las cámaras te siguen. ¿Te arriesgas a burlar?' },
        { id: 'rooftop-jump', emoji: '🪂', title: 'Salto', prompt: 'Hay un salto entre edificios. Tú decides.' },
        { id: 'sewer-drop', emoji: '🕳️', title: 'Tapa de alcantarilla', prompt: 'Puedes bajar a las cloacas. O no.' },
        { id: 'forest-edge', emoji: '🌲', title: 'Borde del bosque', prompt: 'Oscuridad y ramas. Camino seguro o atajo.' },
        { id: 'bridge-crossing', emoji: '🌉', title: 'Puente', prompt: 'El puente es rápido pero visible. ¿Riesgo?' },
        { id: 'crowd-metro', emoji: '🚉', title: 'Multitud en estación', prompt: 'Puedes mezclarse… o correr.' },
        { id: 'harbor-boat', emoji: '⛴️', title: 'Barca del puerto', prompt: 'Una barca se suelta. ¿La usas?' },
    ];

    const base = [];

    // Buttons: 30
    for (let i = 0; i < Math.min(30, buttonScenes.length); i++) {
        const s = buttonScenes[i];
        base.push({
            id: s.id,
            emoji: s.emoji,
            title: s.title,
            prompt: s.prompt,
            kind: 'buttons',
            options: makeButtonsOptions(i),
        });
    }

    // Wires: 10 (reutiliza escenas existentes, pero con interacción distinta)
    for (let i = 30; i < Math.min(40, buttonScenes.length); i++) {
        const s = buttonScenes[i];
        base.push(makeWiresActivity({ ...s, tier: i }));
    }

    // Doors: 30
    for (let i = 0; i < Math.min(30, doorScenes.length); i++) {
        const s = doorScenes[i];
        base.push(makeDoorsActivity({ ...s, tier: i }));
    }

    // Risk: 30
    for (let i = 0; i < Math.min(30, riskScenes.length); i++) {
        const s = riskScenes[i];
        base.push(makeRiskActivity({ ...s, tier: i }));
    }

    // Asegurar unicidad por id
    const seen = new Set();
    const uniq = [];
    for (const a of base) {
        const id = String(a?.id || '').trim().toLowerCase();
        if(id && !seen.has(id)) {
            seen.add(id);
            uniq.push({ ...a, id });
        }
    }

    return uniq;
}

const CRIME_ACTIVITIES = Object.freeze(buildGeneratedCrimeActivities());

function getCrimeActivity(id) {
    const key = String(id || '').trim().toLowerCase();
    return CRIME_ACTIVITIES.find(a => a.id === key) || null;
}

function pickRandomCrimeActivity() {
    return CRIME_ACTIVITIES[randInt(0, CRIME_ACTIVITIES.length - 1)] || CRIME_ACTIVITIES[0];
}

module.exports = {
    CRIME_ACTIVITIES,
    getCrimeActivity,
    pickRandomCrimeActivity,
};
