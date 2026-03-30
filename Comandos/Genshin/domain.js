const { ContainerBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { genshinCategory } = require('../../Util/commandCategories');

const JMP_DOMAINS = 'https://genshin.jmp.blue/domains';

// Traducciones estáticas de nombres de dominios (inglés → español)
const DOMAIN_ES = {
    'cecilia-garden':                       'Jardín de Cecilias',
    'city-of-gold':                         'Ciudad de Oro',
    'clear-pool-and-mountain-cavern':       'Charca Transparente y Caverna del Monte',
    'court-of-flowing-sands':              'Patio de las Arenas Fluyentes',
    'domain-of-guyun':                      'Dominio de Guyun',
    'echoes-of-the-deep-tides':            'Ecos de las Mareas Profundas',
    'faded-theater':                        'Teatro Desvanecido',
    'hidden-palace-of-lianshan-formula':   'Palacio Oculto de la Fórmula de Lianshan',
    'midsummer-courtyard':                  'Jardín Estival',
    'momiji-dyed-court':                    'Jardín Teñido de Momiji',
    'peak-of-vindagnyr':                    'Pico de Vindagnyr',
    'ridge-watch':                          'Atalaya de la Cresta',
    'slumbering-court':                     'Patio Adormecido',
    'spire-of-solitary-enlightenment':     'Aguja de la Iluminación Solitaria',
    'the-lost-valley':                      'El Valle Perdido',
    'tower-of-abject-pride':               'Torre del Orgullo Abyecto',
    'valley-of-remembrance':               'Valle del Recuerdo',
};

// Traducciones de elementos
const ELEM_ES = {
    Anemo: 'Anemo', Cryo: 'Cryo', Dendro: 'Dendro',
    Electro: 'Electro', Geo: 'Geo', Hydro: 'Hydro', Pyro: 'Pyro',
};

// Sugerencias de personajes por set de artefactos (drops reales del dominio)
const RECOMMENDED_BY_SET = {
    'Gladiator\'s Finale': ['Navia', 'Xiao', 'Razor'],
    'Wanderer\'s Troupe': ['Ganyu', 'Tighnari', 'Yanfei'],
    'Thundersoother': ['Keqing', 'Yae Miko', 'Fischl'],
    'Thundering Fury': ['Cyno', 'Keqing', 'Fischl'],
    'Lavawalker': ['Klee', 'Diluc', 'Lyney'],
    'Crimson Witch of Flames': ['Hu Tao', 'Arlecchino', 'Diluc'],
    'Maiden Beloved': ['Barbara', 'Kokomi', 'Qiqi'],
    'Viridescent Venerer': ['Kazuha', 'Sucrose', 'Venti'],
    'Archaic Petra': ['Zhongli', 'Ningguang', 'Navia'],
    'Retracing Bolide': ['Noelle', 'Yoimiya', 'Yanfei'],
    'Blizzard Strayer': ['Ayaka', 'Ganyu', 'Wriothesley'],
    'Heart of Depth': ['Tartaglia', 'Ayato', 'Neuvillette'],
    'Tenacity of the Millelith': ['Zhongli', 'Kuki Shinobu', 'Layla'],
    'Pale Flame': ['Eula', 'Razor', 'Freminet'],
    'Shimenawa\'s Reminiscence': ['Yoimiya', 'Hu Tao', 'Wanderer'],
    'Emblem of Severed Fate': ['Raiden Shogun', 'Xiangling', 'Yelan'],
    'Husk of Opulent Dreams': ['Arataki Itto', 'Noelle', 'Albedo'],
    'Ocean-Hued Clam': ['Kokomi', 'Qiqi', 'Barbara'],
    'Vermillion Hereafter': ['Xiao', 'Gaming', 'DPS Jean'],
    'Echoes of an Offering': ['Ayato', 'Yoimiya', 'Wriothesley'],
    'Deepwood Memories': ['Nahida', 'Baizhu', 'Kirara'],
    'Gilded Dreams': ['Alhaitham', 'Cyno', 'Yae Miko'],
    'Desert Pavilion Chronicle': ['Wanderer', 'Heizou', 'Xiao'],
    'Flower of Paradise Lost': ['Kuki Shinobu', 'Thoma', 'Raiden Shogun'],
    'Nymph\'s Dream': ['Tartaglia', 'Ayato', 'Neuvillette'],
    'Vourukasha\'s Glow': ['Dehya', 'Nilou', 'Neuvillette'],
    'Marechaussee Hunter': ['Neuvillette', 'Wriothesley', 'Lyney'],
    'Golden Troupe': ['Furina', 'Fischl', 'Yae Miko'],
    'Song of Days Past': ['Xianyun', 'Kokomi', 'Charlotte'],
    'Nighttime Whispers in the Echoing Woods': ['Navia', 'Ningguang', 'Chiori'],
    'Unfinished Reverie': ['Arlecchino', 'Clorinde', 'Lyney'],
    'Fragment of Harmonic Whimsy': ['Arlecchino', 'Gaming', 'Freminet'],
};

// Búsquedas en español → slug
const SEARCH_ES = {
    'jardin de cecilias': 'cecilia-garden',
    'cecilia': 'cecilia-garden',
    'ciudad de oro': 'city-of-gold',
    'oro': 'city-of-gold',
    'charca transparente': 'clear-pool-and-mountain-cavern',
    'aocang': 'clear-pool-and-mountain-cavern',
    'patio de las arenas': 'court-of-flowing-sands',
    'arenas fluyentes': 'court-of-flowing-sands',
    'yougou': 'court-of-flowing-sands',
    'dominio de guyun': 'domain-of-guyun',
    'guyun': 'domain-of-guyun',
    'ecos de las mareas': 'echoes-of-the-deep-tides',
    'mareas profundas': 'echoes-of-the-deep-tides',
    'teatro desvanecido': 'faded-theater',
    'teatro': 'faded-theater',
    'palacio oculto': 'hidden-palace-of-lianshan-formula',
    'lianshan': 'hidden-palace-of-lianshan-formula',
    'jardin estival': 'midsummer-courtyard',
    'estival': 'midsummer-courtyard',
    'starsnatch': 'midsummer-courtyard',
    'momiji': 'momiji-dyed-court',
    'pico de vindagnyr': 'peak-of-vindagnyr',
    'vindagnyr': 'peak-of-vindagnyr',
    'dragonspine': 'peak-of-vindagnyr',
    'atalaya de la cresta': 'ridge-watch',
    'ridge watch': 'ridge-watch',
    'bishui': 'ridge-watch',
    'patio adormecido': 'slumbering-court',
    'slumbering': 'slumbering-court',
    'seirai': 'slumbering-court',
    'aguja de la iluminacion': 'spire-of-solitary-enlightenment',
    'iluminacion solitaria': 'spire-of-solitary-enlightenment',
    'gandha': 'spire-of-solitary-enlightenment',
    'valle perdido': 'the-lost-valley',
    'the lost valley': 'the-lost-valley',
    'chasm': 'the-lost-valley',
    'torre del orgullo': 'tower-of-abject-pride',
    'abject pride': 'tower-of-abject-pride',
    'apam': 'tower-of-abject-pride',
    'valle del recuerdo': 'valley-of-remembrance',
    'recuerdo': 'valley-of-remembrance',
    'dawn winery': 'valley-of-remembrance',
};

let domainsCache = null;      // Map<slug, domainData>
let domainsCacheTime = 0;

function norm(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function getAllDomains() {
    const now = Date.now();
    if (domainsCache && (now - domainsCacheTime) < 6 * 60 * 60 * 1000) return domainsCache;

    try {
        const { data: slugs } = await axios.get(JMP_DOMAINS, { timeout: 10_000 });
        const results = await Promise.all(
            slugs.map(slug =>
                axios.get(`${JMP_DOMAINS}/${slug}`, { timeout: 10_000 })
                    .then(r => ({ slug, ...r.data }))
                    .catch(() => null)
            )
        );

        const map = new Map();
        for (const d of results) {
            if (d) map.set(d.slug, d);
        }
        domainsCache = map;
        domainsCacheTime = now;
    } catch (err) {
        console.error('Error fetching domains:', err.message);
        domainsCache = domainsCache || new Map();
    }

    return domainsCache;
}

function findDomain(map, query) {
    const q = norm(query);

    // 1. Mapa de alias en español
    if (SEARCH_ES[q]) return map.get(SEARCH_ES[q]) || null;
    for (const [alias, slug] of Object.entries(SEARCH_ES)) {
        if (q.includes(alias) || alias.includes(q)) {
            const d = map.get(slug);
            if (d) return d;
        }
    }

    // 2. Nombre en español traducido
    for (const [slug, esName] of Object.entries(DOMAIN_ES)) {
        if (norm(esName).includes(q) || q.includes(norm(esName))) {
            const d = map.get(slug);
            if (d) return d;
        }
    }

    // 3. Nombre o slug en inglés
    for (const [slug, d] of map) {
        if (norm(slug) === q || norm(d.name) === q) return d;
    }
    const hits = [];
    for (const [slug, d] of map) {
        if (norm(d.name).includes(q) || norm(slug).includes(q)) hits.push(d);
    }
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return hits.sort((a, b) => a.name.length - b.name.length)[0];

    return null;
}

function typeLabel(type) {
    if (type === 'Blessing') return '🏺 Artefactos';
    if (type === 'Forgery')  return '⚔️ Materiales';
    return type || 'N/D';
}

function formatDrops(domain) {
    const lines = [];
    for (const reward of domain.rewards || []) {
        const last = reward.details?.[reward.details.length - 1];
        const highRarity = (last?.drops || []).filter(d =>
            typeof d.rarity === 'string' ? d.rarity.includes('4') || d.rarity.includes('5') : Number(d.rarity) >= 4
        );
        if (!highRarity.length) continue;
        const dayLabel = reward.day === 'always' ? 'Siempre' :
            ({ mon: 'Lun/Jue', tue: 'Mar/Vie', wed: 'Mié/Sáb', thu: 'Jue/Dom',
               fri: 'Vie/Lun', sat: 'Sáb/Mar', sun: 'Dom/Mié' }[reward.day] || reward.day);
        lines.push(`**${dayLabel}:** ${highRarity.map(d => d.name).join(', ')}`);
    }
    return lines.length ? lines.join('\n') : 'N/D';
}

function extractHighRarityDrops(domain) {
    const set = new Set();
    for (const reward of domain?.rewards || []) {
        const last = reward.details?.[reward.details.length - 1];
        for (const drop of last?.drops || []) {
            const rarity = drop?.rarity;
            const isHigh = typeof rarity === 'string'
                ? rarity.includes('4') || rarity.includes('5')
                : Number(rarity) >= 4;
            const name = String(drop?.name || '').trim();
            if (isHigh && name) set.add(name);
        }
    }
    return [...set];
}

function buildRecommendedFor(domain) {
    const sets = extractHighRarityDrops(domain);
    if (!sets.length) return 'N/D';

    const lines = [];
    for (const setName of sets) {
        const picks = RECOMMENDED_BY_SET[setName] || [];
        if (picks.length) {
            lines.push(`• ${setName}: ${picks.join(', ')}`);
        }
    }

    return lines.length ? lines.join('\n') : 'N/D';
}

module.exports = {
    name: 'domain',
    alias: ['dom', 'gdom', 'gidom', 'dominio', 'dominios', 'domainlist', 'domain'],
    Category: genshinCategory,
    usage: 'domain <nombre>',
    description: 'Muestra info de un dominio de Genshin Impact.',
    cooldown: 2,

    async execute(Moxi, message, args) {
        const map = await getAllDomains();

        // Sin args: listar todos los dominios
        if (!args || args.length === 0) {
            const blessing = [...map.values()].filter(d => d.type === 'Blessing');
            const forgery  = [...map.values()].filter(d => d.type === 'Forgery');

            const listSection = (type, list) =>
                `**${typeLabel(type)}**\n${list.map(d => `• ${DOMAIN_ES[d.slug] || d.name} — ${d.nation || 'N/D'}`).join('\n')}`;

            const container = new ContainerBuilder()
                .setAccentColor(0x5B8DD9)
                .addTextDisplayComponents(c => c.setContent('# 🏛️ Dominios de Genshin'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(listSection('Blessing', blessing)))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(listSection('Forgery', forgery)))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent('Usa `.gidom <nombre>` para ver detalles\nEjemplo: `.gidom vindagnyr` o `.gidom pico de vindagnyr`'));

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const query = args.join(' ').trim();
        const domain = findDomain(map, query);

        if (!domain) {
            const examples = Object.values(DOMAIN_ES).slice(0, 6).join(', ');
            const container = new ContainerBuilder()
                .setAccentColor(0xE67E22)
                .addTextDisplayComponents(c => c.setContent('# 🏛️ Dominio no encontrado'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    `No encontré **${query}**.\nPuedes buscar en español o inglés.\n\nEjemplos: ${examples}`
                ));
            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const esName = DOMAIN_ES[domain.slug] || domain.name;
        const elems = Array.isArray(domain.recommendedElements) && domain.recommendedElements.length
            ? domain.recommendedElements.map(e => ELEM_ES[e] || e).join(', ')
            : null;

        const infoLines = [
            `Tipo: **${typeLabel(domain.type)}**`,
            `Nación: **${domain.nation || 'N/D'}**`,
            `Ubicación: ${domain.location || 'N/D'}`,
        ];
        if (elems) infoLines.push(`Elementos recomendados: ${elems}`);
        infoLines.push('', '**Recompensas (4★/5★):**', formatDrops(domain));
        infoLines.push('', '**Recomendado para:**', buildRecommendedFor(domain));

        const container = new ContainerBuilder()
            .setAccentColor(0x5B8DD9)
            .addTextDisplayComponents(c => c.setContent(`# 🏛️ ${esName}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(infoLines.join('\n')));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
