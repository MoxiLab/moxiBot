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

const JMP_API = 'https://genshin.jmp.blue/enemies';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let enemiesCache = null;
let enemiesCacheTime = 0;
const enemyInfoCache = new Map();

async function getEnemiesList() {
    const now = Date.now();
    if (enemiesCache && (now - enemiesCacheTime) < CACHE_TTL_MS) {
        return enemiesCache;
    }

    try {
        const { data } = await axios.get(JMP_API, { timeout: 10_000 });
        if (Array.isArray(data)) {
            enemiesCache = data.sort();
            enemiesCacheTime = now;
            return enemiesCache;
        }
    } catch (err) {
        console.error('Error fetching enemies from genshin.jmp.blue:', err.message);
    }

    return [];
}

async function getEnemyInfo(slug) {
    const now = Date.now();
    const cached = enemyInfoCache.get(slug);
    if (cached && (now - cached.at) < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const { data } = await axios.get(`${JMP_API}/${slug}`, { timeout: 10_000 });
        if (data && typeof data === 'object') {
            enemyInfoCache.set(slug, { data, at: now });
            return data;
        }
    } catch {
        // noop
    }

    return null;
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

function formatEnemyName(slug) {
    return String(slug || '')
        .split('-')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function findEnemySlug(list, rawQuery) {
    const query = normalizeQuery(rawQuery);
    if (!query) return null;

    if (list.includes(query)) return query;

    const startsWith = list.find(name => normalizeQuery(name).startsWith(query));
    if (startsWith) return startsWith;

    const includes = list.find(name => normalizeQuery(name).includes(query));
    if (includes) return includes;

    return null;
}

function getEnemyIconUrl(slug) {
    return `${JMP_API}/${slug}/icon`;
}

function getEnemyPortraitUrl(slug) {
    return `${JMP_API}/${slug}/portrait`;
}

function shortText(value, max = 320) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'N/D';
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}...`;
}

function toListText(items, max = 4) {
    if (!Array.isArray(items) || items.length === 0) return 'N/D';

    return items
        .slice(0, max)
        .map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                return String(item.name || item.id || item.slug || '').trim();
            }
            return '';
        })
        .filter(Boolean)
        .join(' | ') || 'N/D';
}

function buildEnemySummaryLines(info) {
    const type = info?.type || 'N/D';
    const family = info?.family || 'N/D';
    const region = info?.region || 'N/D';
    const faction = info?.faction || 'N/D';
    const elements = toListText(info?.elements, 3);

    return [
        `Tipo: **${type}** | Familia: **${family}**`,
        `Región: **${region}** | Facción: **${faction}**`,
        `Elementos: **${elements}**`,
    ];
}

function buildEnemyDetailedLines(info) {
    const base = buildEnemySummaryLines(info);
    const drops = toListText(info?.drops, 5);
    const artifacts = toListText(info?.artifacts, 4);
    const mora = Number.isFinite(Number(info?.['mora-gained'])) ? Number(info['mora-gained']) : 'N/D';
    const description = shortText(info?.description, 500);

    return [
        ...base,
        `Mora ganada: **${mora}**`,
        `Drops: **${drops}**`,
        `Artefactos: **${artifacts}**`,
        `Resumen: ${description}`,
    ];
}

function paginateList(array, page, perPage = 6) {
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

async function buildEnemiesContainer({ list, page, perPage, navBaseId, disableNav = false }) {
    const paginationData = paginateList(list, page, perPage);
    const current = paginationData.page;
    const totalPages = paginationData.totalPages;

    const container = new ContainerBuilder()
        .setAccentColor(0xC0392B)
        .addTextDisplayComponents(c => c.setContent('# 👹 Enemigos de Genshin Impact'))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**Página ${current} de ${totalPages}** (${paginationData.total} enemigos)`));

    const pageRows = await Promise.all(paginationData.items.map(async (slug, index) => {
        const num = (current - 1) * perPage + index + 1;
        const formatted = formatEnemyName(slug);
        const info = await getEnemyInfo(slug);
        const iconUrl = getEnemyIconUrl(slug);

        return { num, formatted, info, iconUrl };
    }));

    for (const row of pageRows) {
        const lines = buildEnemySummaryLines(row.info);

        container.addSectionComponents(section => {
            const built = section.addTextDisplayComponents(td =>
                td.setContent([`**${row.num}. ${row.formatted}**`, ...lines].join('\n'))
            );

            built.setThumbnailAccessory(new ThumbnailBuilder().setURL(row.iconUrl));
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
    name: 'enemies',
    alias: ['enemy', 'enemigo', 'enemigos', 'gienemies', 'gienemy'],
    Category: genshinCategory,
    usage: 'enemies [página|nombre]',
    description: 'Muestra lista de enemigos o la ficha de uno en específico.',
    cooldown: 2,

    async execute(Moxi, message, args) {
        const enemiesList = await getEnemiesList();
        if (!enemiesList || enemiesList.length === 0) {
            return message.reply({
                content: '❌ No se pudo obtener la lista de enemigos en este momento.',
                allowedMentions: { repliedUser: false },
            });
        }

        const rawInput = String(args?.join(' ') || '').trim();
        const parsedPage = parseInt(rawInput || '1', 10);
        const isPageMode = !rawInput || /^\d+$/.test(rawInput);

        if (!isPageMode) {
            const slug = findEnemySlug(enemiesList, rawInput);
            if (!slug) {
                return message.reply({
                    content: '❌ No encontré ese enemigo. Usa el nombre en inglés o ejecuta `.enemies` para ver la lista.',
                    allowedMentions: { repliedUser: false },
                });
            }

            const info = await getEnemyInfo(slug);
            const iconUrl = getEnemyIconUrl(slug);
            const portraitUrl = getEnemyPortraitUrl(slug);
            const displayName = formatEnemyName(slug);
            const lines = buildEnemyDetailedLines(info);

            const singleContainer = new ContainerBuilder()
                .setAccentColor(0xC0392B)
                .addTextDisplayComponents(c => c.setContent('# 👹 Ficha de Enemigo'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addSectionComponents(section => {
                    const built = section.addTextDisplayComponents(td =>
                        td.setContent([`**${displayName}**`, ...lines].join('\n'))
                    );
                    built.setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl));
                    return built;
                })
                .addSeparatorComponents(s => s.setDivider(true))
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(portraitUrl)
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
        const firstPageData = paginateList(enemiesList, requestedPage, 6);

        if (firstPageData.page !== requestedPage) {
            return message.reply({
                content: `❌ Página inválida. Total de páginas: **${firstPageData.totalPages}**`,
                allowedMentions: { repliedUser: false },
            });
        }

        const navBaseId = `gienemies_nav:${message.author.id}:${Date.now().toString(36)}`;
        let currentPage = firstPageData.page;

        const initialPanel = await buildEnemiesContainer({
            list: enemiesList,
            page: currentPage,
            perPage: 6,
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

                const panel = await buildEnemiesContainer({
                    list: enemiesList,
                    page: currentPage,
                    perPage: 6,
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
                const lockedPanel = await buildEnemiesContainer({
                    list: enemiesList,
                    page: currentPage,
                    perPage: 6,
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
