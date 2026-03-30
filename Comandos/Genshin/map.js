const {
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    ButtonStyle,
} = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const { genshinCategory } = require('../../Util/commandCategories');

const OFFICIAL_MAP_URL = 'https://act.hoyolab.com/ys/app/interactive-map/index.html?lang=es-es#/map/2';
const ALT_MAP_URL = 'https://genshin-impact-map.appsample.com/';

const REGION_INFO = {
    mondstadt: {
        label: 'Mondstadt',
        aliases: ['mond', 'mondo'],
        wikiUrl: 'https://genshin-impact.fandom.com/wiki/Mondstadt',
        imageUrl: 'https://genshin.jmp.blue/nations/mondstadt/icon.png',
    },
    liyue: {
        label: 'Liyue',
        aliases: ['liyue'],
        wikiUrl: 'https://genshin-impact.fandom.com/wiki/Liyue',
        imageUrl: 'https://genshin.jmp.blue/nations/liyue/icon.png',
    },
    inazuma: {
        label: 'Inazuma',
        aliases: ['ina'],
        wikiUrl: 'https://genshin-impact.fandom.com/wiki/Inazuma',
        imageUrl: 'https://genshin.jmp.blue/nations/inazuma/icon.png',
    },
    sumeru: {
        label: 'Sumeru',
        aliases: ['sum'],
        wikiUrl: 'https://genshin-impact.fandom.com/wiki/Sumeru',
        imageUrl: 'https://genshin.jmp.blue/nations/sumeru/icon.png',
    },
    fontaine: {
        label: 'Fontaine',
        aliases: ['fonte', 'font'],
        wikiUrl: 'https://genshin-impact.fandom.com/wiki/Fontaine',
        imageUrl: 'https://genshin.jmp.blue/nations/fontaine/icon.png',
    },
    natlan: {
        label: 'Natlan',
        aliases: ['nat'],
        wikiUrl: 'https://genshin-impact.fandom.com/wiki/Natlan',
        imageUrl: null,
    },
    snezhnaya: {
        label: 'Snezhnaya',
        aliases: ['snez', 'snezhnaya'],
        wikiUrl: 'https://genshin-impact.fandom.com/wiki/Snezhnaya',
        imageUrl: null,
    },
};

const DEFAULT_MAP_IMAGE = 'https://genshin.jmp.blue/nations/mondstadt/icon.png';

function norm(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function findRegion(query) {
    const q = norm(query);
    if (!q) return null;

    for (const [key, region] of Object.entries(REGION_INFO)) {
        if (norm(key) === q || norm(region.label) === q) return { key, ...region };
        if ((region.aliases || []).some(a => norm(a) === q)) return { key, ...region };
    }

    for (const [key, region] of Object.entries(REGION_INFO)) {
        if (norm(key).includes(q) || norm(region.label).includes(q)) return { key, ...region };
        if ((region.aliases || []).some(a => norm(a).includes(q))) return { key, ...region };
    }

    return null;
}

module.exports = {
    name: 'genshinmap',
    alias: ['gimap', 'mapagi', 'mapa', 'maps', 'map', 'mapas'],
    Category: genshinCategory,
    usage: 'genshinmap [region]',
    description: 'Muestra mapas utiles de Genshin y accesos por region.',
    cooldown: 2,

    async execute(Moxi, message, args) {
        const query = String(args?.join(' ') || '').trim();
        const picked = query ? findRegion(query) : null;

        const lines = [
            '• Mapa oficial interactivo (HoYoLab)',
            '• Mapa alternativo para rutas',
        ];

        if (picked) {
            lines.push('', `Región detectada: **${picked.label}**`, `Wiki de región: ${picked.wikiUrl}`);
        } else if (query) {
            const valid = Object.values(REGION_INFO).map(x => x.label).join(', ');
            lines.push('', `No encontré la región **${query}**.`, `Prueba con: ${valid}`);
        }

        const container = new ContainerBuilder()
            .setAccentColor(0x4EA87B)
            .addTextDisplayComponents(c => c.setContent('# 🗺️ Genshin • Mapas'))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(lines.join('\n')))
            .addSeparatorComponents(s => s.setDivider(true))
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(picked?.imageUrl || DEFAULT_MAP_IMAGE)
                )
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addActionRowComponents(row => row.addComponents(
                new ButtonBuilder()
                    .setLabel('Mapa Oficial')
                    .setStyle(ButtonStyle.Link)
                    .setURL(OFFICIAL_MAP_URL),
                new ButtonBuilder()
                    .setLabel('Mapa Alternativo')
                    .setStyle(ButtonStyle.Link)
                    .setURL(ALT_MAP_URL),
            ))
            .addActionRowComponents(row => row.addComponents(
                new ButtonBuilder().setLabel('Mondstadt').setStyle(ButtonStyle.Link).setURL(REGION_INFO.mondstadt.wikiUrl),
                new ButtonBuilder().setLabel('Liyue').setStyle(ButtonStyle.Link).setURL(REGION_INFO.liyue.wikiUrl),
                new ButtonBuilder().setLabel('Inazuma').setStyle(ButtonStyle.Link).setURL(REGION_INFO.inazuma.wikiUrl),
                new ButtonBuilder().setLabel('Sumeru').setStyle(ButtonStyle.Link).setURL(REGION_INFO.sumeru.wikiUrl),
            ))
            .addActionRowComponents(row => row.addComponents(
                new ButtonBuilder().setLabel('Fontaine').setStyle(ButtonStyle.Link).setURL(REGION_INFO.fontaine.wikiUrl),
                new ButtonBuilder().setLabel('Natlan').setStyle(ButtonStyle.Link).setURL(REGION_INFO.natlan.wikiUrl),
                new ButtonBuilder().setLabel('Snezhnaya').setStyle(ButtonStyle.Link).setURL(REGION_INFO.snezhnaya.wikiUrl),
            ));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
