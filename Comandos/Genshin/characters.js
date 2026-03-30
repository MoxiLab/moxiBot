const {
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    ThumbnailBuilder,
    ButtonStyle,
} = require('discord.js');
const axios = require('axios');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const { genshinCategory } = require('../../Util/commandCategories');

const JMP_API = 'https://genshin.jmp.blue/characters';
let charactersCache = null;
let charactersCacheTime = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const characterInfoCache = new Map();

async function getCharactersList() {
    const now = Date.now();
    if (charactersCache && (now - charactersCacheTime) < CACHE_TTL_MS) {
        return charactersCache;
    }
    
    try {
        const { data } = await axios.get(JMP_API, { timeout: 10_000 });
        if (Array.isArray(data)) {
            charactersCache = data.sort();
            charactersCacheTime = now;
            return charactersCache;
        }
    } catch (err) {
        console.error('Error fetching characters from genshin.jmp.blue:', err.message);
    }
    return [];
}

function formatCharacterName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
}

function normalizeQuery(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function findCharacterSlug(list, rawQuery) {
    const query = normalizeQuery(rawQuery);
    if (!query) return null;

    if (list.includes(query)) return query;

    const startsWith = list.find(name => normalizeQuery(name).startsWith(query));
    if (startsWith) return startsWith;

    const includes = list.find(name => normalizeQuery(name).includes(query));
    if (includes) return includes;

    return null;
}

function getCharacterImageUrl(name) {
    return `${JMP_API}/${name}/icon-big`;
}

function getCharacterCardUrl(name) {
    return `${JMP_API}/${name}/card`;
}

function getCharacterSplashUrl(name) {
    return `${JMP_API}/${name}/gacha-splash`;
}

async function getCharacterInfo(name) {
    const now = Date.now();
    const cached = characterInfoCache.get(name);
    if (cached && (now - cached.at) < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const { data } = await axios.get(`${JMP_API}/${name}`, { timeout: 10_000 });
        if (data && typeof data === 'object') {
            characterInfoCache.set(name, { data, at: now });
            return data;
        }
    } catch {
        // noop
    }

    return null;
}

function buildInfoLines(info) {
    const vision = info?.vision || info?.vision_key || 'N/D';
    const weapon = info?.weapon || info?.weapon_type || 'N/D';
    const nation = info?.nation || 'N/D';
    const affiliation = info?.affiliation || 'N/D';
    const constellation = info?.constellation || 'N/D';
    const rarityNum = Number(info?.rarity);
    const rarity = Number.isFinite(rarityNum) && rarityNum > 0 ? `${rarityNum}★` : 'N/D';

    return [
        `Elemento: **${vision}** | Arma: **${weapon}**`,
        `Rareza: **${rarity}** | Nación: **${nation}**`,
        `Afiliación: **${affiliation}**`,
        `Constelación: **${constellation}**`,
    ];
}

function formatDateLabel(rawDate) {
    const value = String(rawDate || '').trim();
    if (!value) return 'N/D';

    if (/^0000-\d{2}-\d{2}$/.test(value)) {
        const [, mm, dd] = value.split('-');
        return `${dd}/${mm}`;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
}

function shortText(value, max = 260) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'N/D';
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}...`;
}

function extractTalentNames(list, maxItems = 3) {
    if (!Array.isArray(list) || list.length === 0) return 'N/D';
    return list
        .slice(0, maxItems)
        .map(item => String(item?.name || '').trim())
        .filter(Boolean)
        .join(' | ') || 'N/D';
}

function buildDetailedInfoLines(info) {
    const base = buildInfoLines(info);
    const title = info?.title || 'N/D';
    const gender = info?.gender || 'N/D';
    const birthday = formatDateLabel(info?.birthday);
    const release = formatDateLabel(info?.release);
    const talents = extractTalentNames(info?.skillTalents, 3);
    const passives = extractTalentNames(info?.passiveTalents, 3);
    const description = shortText(info?.description, 420);

    return [
        `Título: **${title}** | Género: **${gender}**`,
        ...base,
        `Cumpleaños: **${birthday}** | Lanzamiento: **${release}**`,
        `Talentos: **${talents}**`,
        `Pasivas: **${passives}**`,
        `Resumen: ${description}`,
    ];
}

function paginateList(array, page, perPage = 4) {
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

async function buildCharactersContainer({ list, page, perPage, navBaseId, disableNav = false }) {
    const paginationData = paginateList(list, page, perPage);
    const current = paginationData.page;
    const totalPages = paginationData.totalPages;

    const container = new ContainerBuilder()
        .setAccentColor(0xE67E22)
        .addTextDisplayComponents(c => c.setContent('# 👥 Personajes de Genshin Impact'))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**Página ${current} de ${totalPages}** (${paginationData.total} personajes)`));

    const pageRows = await Promise.all(paginationData.items.map(async (name, index) => {
        const num = (current - 1) * perPage + index + 1;
        const formatted = formatCharacterName(name);
        const info = await getCharacterInfo(name);
        const imageUrl = getCharacterImageUrl(name);

        return { num, formatted, info, imageUrl };
    }));

    for (const row of pageRows) {
        const lines = buildInfoLines(row.info);

        container.addSectionComponents(section => {
            const built = section.addTextDisplayComponents(td =>
                td.setContent([`**${row.num}. ${row.formatted}**`, ...lines].join('\n'))
            );

            built.setThumbnailAccessory(new ThumbnailBuilder().setURL(row.imageUrl));
            return built;
        });

        container.addSeparatorComponents(s => s.setDivider(true));
    }

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
    name: 'characters',
    alias: ['chars', 'gicharacters', 'gichar', 'personajes', 'gipersonajes', 'allchars'],
    Category: genshinCategory,
    usage: 'characters [página|nombre]',
    description: 'Muestra lista de personajes o la ficha de uno en específico.',
    cooldown: 2,

    async execute(Moxi, message, args) {
        const charactersList = await getCharactersList();
        if (!charactersList || charactersList.length === 0) {
            return message.reply({
                content: '❌ No se pudo obtener la lista de personajes en este momento.',
                allowedMentions: { repliedUser: false },
            });
        }

        const rawInput = String(args?.join(' ') || '').trim();
        const parsedPage = parseInt(rawInput || '1', 10);
        const isPageMode = !rawInput || /^\d+$/.test(rawInput);

        if (!isPageMode) {
            const slug = findCharacterSlug(charactersList, rawInput);
            if (!slug) {
                return message.reply({
                    content: '❌ No encontré ese personaje. Prueba con el nombre en inglés o usa `.characters` para ver la lista.',
                    allowedMentions: { repliedUser: false },
                });
            }

            const info = await getCharacterInfo(slug);
            const imageUrl = getCharacterImageUrl(slug);
            const cardUrl = getCharacterCardUrl(slug);
            const splashUrl = getCharacterSplashUrl(slug);
            const displayName = formatCharacterName(slug);
            const lines = buildDetailedInfoLines(info);

            const singleContainer = new ContainerBuilder()
                .setAccentColor(0xE67E22)
                .addTextDisplayComponents(c => c.setContent('# 👤 Ficha de Personaje'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addSectionComponents(section => {
                    const built = section.addTextDisplayComponents(td =>
                        td.setContent([`**${displayName}**`, ...lines].join('\n'))
                    );
                    built.setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl));
                    return built;
                })
                .addSeparatorComponents(s => s.setDivider(true))
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(cardUrl),
                        new MediaGalleryItemBuilder().setURL(splashUrl)
                    )
                );

            return message.reply({
                content: '',
                components: [singleContainer],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const requestedPage = parsedPage || 1;
        const firstPageData = paginateList(charactersList, requestedPage, 4);

        if (firstPageData.page !== requestedPage) {
            return message.reply({
                content: `❌ Página inválida. Total de páginas: **${firstPageData.totalPages}**`,
                allowedMentions: { repliedUser: false },
            });
        }

        const navBaseId = `gichars_nav:${message.author.id}:${Date.now().toString(36)}`;
        let currentPage = firstPageData.page;

        const initialPanel = await buildCharactersContainer({
            list: charactersList,
            page: currentPage,
            perPage: 4,
            navBaseId,
            disableNav: false,
        });
        currentPage = initialPanel.page;

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

                const panel = await buildCharactersContainer({
                    list: charactersList,
                    page: currentPage,
                    perPage: 4,
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
                const lockedPanel = await buildCharactersContainer({
                    list: charactersList,
                    page: currentPage,
                    perPage: 4,
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
    },
};
