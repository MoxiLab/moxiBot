const {
    ContainerBuilder,
    ThumbnailBuilder,
    MessageFlags,
    ButtonStyle,
} = require('discord.js');
const axios = require('axios');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const { genshinCategory } = require('../../Util/commandCategories');
const { fetchCategoryByQuery } = require('../../Util/genshinDbProxy');

const JMP_API = 'https://genshin.jmp.blue/artifacts';

const RECOMMENDED_BY_SET = {
    'viridescent venerer': ['Kazuha', 'Sucrose', 'Venti', 'Heizou'],
    'sombra verde esmeralda': ['Kazuha', 'Sucrose', 'Venti', 'Heizou'],
    'emblem of severed fate': ['Raiden Shogun', 'Xiangling', 'Yelan', 'Xingqiu'],
    'emblema del destino': ['Raiden Shogun', 'Xiangling', 'Yelan', 'Xingqiu'],
    'shimenawa\'s reminiscence': ['Yoimiya', 'Hu Tao', 'Wanderer'],
    'recuerdo de shimenawa': ['Yoimiya', 'Hu Tao', 'Wanderer'],
    'marechaussee hunter': ['Neuvillette', 'Lyney', 'Wriothesley'],
    'cazador fantasmal': ['Neuvillette', 'Lyney', 'Wriothesley'],
    'golden troupe': ['Furina', 'Fischl', 'Yae Miko'],
    'compania dorada': ['Furina', 'Fischl', 'Yae Miko'],
    'deepwood memories': ['Nahida', 'Baizhu', 'Kirara', 'Alhaitham'],
    'memorias del bosque': ['Nahida', 'Baizhu', 'Kirara', 'Alhaitham'],
    'gilded dreams': ['Alhaitham', 'Cyno', 'Yae Miko', 'Kuki Shinobu'],
    'suenos aureos': ['Alhaitham', 'Cyno', 'Yae Miko', 'Kuki Shinobu'],
    'blizzard strayer': ['Ayaka', 'Ganyu', 'Wriothesley'],
    'nomada del invierno': ['Ayaka', 'Ganyu', 'Wriothesley'],
    'heart of depth': ['Tartaglia', 'Ayato', 'Neuvillette'],
    'corazon de las profundidades': ['Tartaglia', 'Ayato', 'Neuvillette'],
    'tenacity of the millelith': ['Zhongli', 'Layla', 'Kuki Shinobu'],
    'tenacidad de la geoarmada': ['Zhongli', 'Layla', 'Kuki Shinobu'],
    'husk of opulent dreams': ['Arataki Itto', 'Noelle', 'Albedo', 'Chiori'],
    'caparazon de suenos opulentos': ['Arataki Itto', 'Noelle', 'Albedo', 'Chiori'],
};

let artifactsCache = null;
let artifactsCacheTime = 0;

let domainMapCache = null;
let domainMapCacheTime = 0;

async function getArtifactDomainMap() {
    const now = Date.now();
    if (domainMapCache && (now - domainMapCacheTime) < 6 * 60 * 60 * 1000) return domainMapCache;

    try {
        const { data: slugs } = await axios.get('https://genshin.jmp.blue/domains', { timeout: 10_000 });
        const results = await Promise.all(
            slugs.map(slug =>
                axios.get(`https://genshin.jmp.blue/domains/${slug}`, { timeout: 10_000 })
                    .then(r => r.data)
                    .catch(() => null)
            )
        );

        const map = new Map();
        for (const domain of results) {
            if (!domain || domain.type !== 'Blessing') continue;
            for (const reward of domain.rewards || []) {
                const lastDetail = reward.details?.[reward.details.length - 1];
                for (const drop of lastDetail?.drops || []) {
                    const key = String(drop.name || '').toLowerCase().trim();
                    if (key && !map.has(key)) {
                        map.set(key, { domainName: domain.name, location: domain.location });
                    }
                }
            }
        }

        domainMapCache = map;
        domainMapCacheTime = now;
    } catch (err) {
        console.error('Error building artifact domain map:', err.message);
        domainMapCache = domainMapCache || new Map();
    }

    return domainMapCache;
}

async function getArtifactsList() {
    const now = Date.now();
    // Cache por 6 horas
    if (artifactsCache && (now - artifactsCacheTime) < 6 * 60 * 60 * 1000) {
        return artifactsCache;
    }
    
    try {
        const { data } = await axios.get(JMP_API, { timeout: 10_000 });
        if (Array.isArray(data)) {
            // Convertir de kebab-case a Title Case
            artifactsCache = data.map(name => {
                return name
                    .split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            }).sort();
            artifactsCacheTime = now;
            return artifactsCache;
        }
    } catch (err) {
        console.error('Error fetching artifacts from API:', err.message);
    }
    return [];
}

function paginate(array, page, perPage = 12) {
    const total = array.length;
    const totalPages = Math.ceil(total / perPage);
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * perPage;
    const end = start + perPage;
    
    return {
        items: array.slice(start, end),
        page: safePage,
        totalPages,
        total,
    };
}

function starsFromRarityList(list) {
    const arr = Array.isArray(list) ? list.map(x => Number(x || 0)).filter(Boolean) : [];
    if (!arr.length) return 'N/D';
    const max = Math.max(...arr);
    return `${max}★`;
}

function normalizeLookupKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function getRecommendedCharactersBySetName(name) {
    const key = normalizeLookupKey(name);
    return RECOMMENDED_BY_SET[key] || [];
}

function resolveArtifactPieceUrl(images, key) {
    const direct = String(images?.[key] || '').trim();
    if (direct) return direct;

    const fileKey = `filename_${key}`;
    const filename = String(images?.[fileKey] || '').trim();
    if (filename) {
        return `https://enka.network/ui/${filename}.png`;
    }

    return '';
}

function buildArtifactsListContainer({ list, page, perPage, navBaseId, disableNav = false }) {
    const paginationData = paginate(list, page, perPage);
    const current = paginationData.page;
    const totalPages = paginationData.totalPages;
    const itemsList = paginationData.items
        .map((name, i) => `${(current - 1) * perPage + i + 1}. ${name}`)
        .join('\n');

    const container = new ContainerBuilder()
        .setAccentColor(0xE67E22)
        .addTextDisplayComponents(c => c.setContent('# 🏺 Sets de Artefactos'))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**Página ${current} de ${totalPages}** (${paginationData.total} total)\n\n${itemsList}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent('Usa: `.giart <nombre>` para ver detalles\nEjemplo: `.giart Viridescent Venerer`'));

    if (totalPages > 1) {
        const prevDisabled = disableNav || current <= 1;
        const nextDisabled = disableNav || current >= totalPages;

        container
            .addSeparatorComponents(s => s.setDivider(true))
            .addActionRowComponents(row => row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${navBaseId}:${current}:prev`)
                    .setLabel('⬅️ Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(prevDisabled),
                new ButtonBuilder()
                    .setCustomId(`${navBaseId}:${current}:next`)
                    .setLabel('Siguiente ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(nextDisabled),
            ));
    }

    return { container, page: current, totalPages };
}

module.exports = {
    name: 'artifact',
    alias: ['art', 'gart', 'giart', 'artefacto', 'setartefactos'],
    Category: genshinCategory,
    usage: 'artifact <nombre>',
    description: 'Muestra informacion clara de un set: rareza, efectos, dominio, personajes recomendados e iconos de piezas.',
    cooldown: 2,

    async execute(Moxi, message, args) {
        // Si no hay args o si el primer argumento es un número, mostrar lista con paginación
        const firstArg = String(args?.[0] || '').trim();
        const isListMode = !args || args.length === 0 || /^\d+$/.test(firstArg);

        if (isListMode) {
            const artifactsList = await getArtifactsList();
            if (!artifactsList || artifactsList.length === 0) {
                return message.reply({
                    content: '❌ No se pudo obtener la lista de artefactos en este momento.',
                    allowedMentions: { repliedUser: false },
                });
            }

            const requestedPage = /^\d+$/.test(firstArg) ? parseInt(firstArg, 10) : 1;
            const firstPanel = buildArtifactsListContainer({
                list: artifactsList,
                page: requestedPage,
                perPage: 12,
                navBaseId: `giart_nav:${message.author.id}:${Date.now().toString(36)}`,
                disableNav: false,
            });

            if (firstPanel.page !== requestedPage) {
                return message.reply({
                    content: `❌ Página inválida. Total de páginas: **${firstPanel.totalPages}**`,
                    allowedMentions: { repliedUser: false },
                });
            }

            let currentPage = firstPanel.page;
            const navBaseId = `giart_nav:${message.author.id}:${Date.now().toString(36)}`;

            const initialPanel = buildArtifactsListContainer({
                list: artifactsList,
                page: currentPage,
                perPage: 12,
                navBaseId,
                disableNav: false,
            });

            const sent = await message.reply({
                content: '',
                components: [initialPanel.container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });

            if (!sent || initialPanel.totalPages <= 1) {
                return sent;
            }

            if (typeof sent.createMessageComponentCollector !== 'function') {
                return sent;
            }

            const collector = sent.createMessageComponentCollector({
                filter: i => i.customId.startsWith(`${navBaseId}:`),
                time: 10 * 60 * 1000,
            });

            collector.on('collect', async i => {
                try {
                    if (i.user?.id !== message.author.id) {
                        return i.reply({
                            content: 'Solo quien ejecutó el comando puede usar esta paginación.',
                            flags: MessageFlags.Ephemeral,
                        }).catch(() => null);
                    }

                    if (i.customId.endsWith(':prev')) currentPage -= 1;
                    if (i.customId.endsWith(':next')) currentPage += 1;

                    const panel = buildArtifactsListContainer({
                        list: artifactsList,
                        page: currentPage,
                        perPage: 12,
                        navBaseId,
                        disableNav: false,
                    });
                    currentPage = panel.page;

                    return i.update({
                        content: '',
                        components: [panel.container],
                        flags: MessageFlags.IsComponentsV2,
                        allowedMentions: { repliedUser: false },
                    }).catch(() => null);
                } catch {
                    return i.reply({
                        content: 'No se pudo cambiar de página en este momento.',
                        flags: MessageFlags.Ephemeral,
                    }).catch(() => null);
                }
            });

            collector.on('end', async () => {
                try {
                    const lockedPanel = buildArtifactsListContainer({
                        list: artifactsList,
                        page: currentPage,
                        perPage: 12,
                        navBaseId,
                        disableNav: true,
                    });

                    await sent.edit({
                        content: '',
                        components: [lockedPanel.container],
                        flags: MessageFlags.IsComponentsV2,
                        allowedMentions: { repliedUser: false },
                    }).catch(() => null);
                } catch {
                    // noop
                }
            });

            return sent;
        }

        // Si es un nombre, buscar el artefacto específico
        const query = String(args?.join(' ') || '').trim();

        const data = await fetchCategoryByQuery('artifacts', query);
        if (!data?.name || String(data.name || '').trim() === '') {
            const container = new ContainerBuilder()
                .setAccentColor(0xE67E22)
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • giart'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`No encontré un set para **${query}**.\nIntenta con otro nombre o nombre en inglés (ej: "Viridescent Venerer").`));
            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const rarity = starsFromRarityList(data.rarityList);
        const effect2 = String(data.effect2Pc || '').trim() || 'N/D';
        const effect4 = String(data.effect4Pc || '').trim() || 'N/D';

        const domainMap = await getArtifactDomainMap();
        const domainInfo = domainMap.get(query.toLowerCase().trim());

        const infoLines = [
            `**Rareza:** ${rarity}`,
        ];
        if (domainInfo) {
            infoLines.push(`**Se consigue en:** ${domainInfo.domainName}`);
            if (domainInfo.location) infoLines.push(`**Ubicacion:** ${domainInfo.location}`);
        }
        infoLines.push('', `**Bono de 2 piezas:** ${effect2}`, `**Bono de 4 piezas:** ${effect4}`);

        const recommended = getRecommendedCharactersBySetName(data.name);
        if (recommended.length) {
            infoLines.push('', `**Recomendado para:** ${recommended.join(', ')}`);
        }

        const container = new ContainerBuilder()
            .setAccentColor(0xC39A5B)
            .addTextDisplayComponents(c => c.setContent(`# 🏺 ${data.name}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(infoLines.join('\n')));

        // Mostrar todas las imágenes del set (5 piezas)
        const pieceNames = { flower: '🌸 Flor', plume: '🪶 Pluma', sands: '⏳ Arenas', goblet: '🏺 Cáliz', circlet: '👑 Diadema' };
        const images = data.images || {};
        const availablePieces = Object.entries(pieceNames)
            .map(([key, name]) => ({ key, name, url: resolveArtifactPieceUrl(images, key) }))
            .filter(piece => piece.url);

        if (availablePieces.length > 0) {
            container.addSeparatorComponents(s => s.setDivider(true));
            for (const { name, url } of availablePieces) {
                container.addSectionComponents(section => {
                    section.addTextDisplayComponents(td => td.setContent(`**${name}**`));
                    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(url));
                    return section;
                });
            }
        }

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
