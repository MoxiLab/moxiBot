const { ContainerBuilder, MessageFlags } = require('discord.js');
const { genshinCategory } = require('../../Util/commandCategories');

async function resolveGuildPrefix(Moxi, message) {
    const guildId = message?.guild?.id;
    const fallback = process.env.PREFIX || '.';
    if (!guildId || typeof Moxi?.guildPrefix !== 'function') return fallback;
    try {
        return await Moxi.guildPrefix(guildId, fallback);
    } catch {
        return fallback;
    }
}

const TOPICS = {
    general: {
        title: 'Guia general',
        lines: [
            '• HoYoLab: https://www.hoyolab.com/',
            '• Wiki oficial (Fandom): https://genshin-impact.fandom.com/wiki/Genshin_Impact_Wiki',
            '• KQM (teoria y guias): https://keqingmains.com/',
            '• Interactivo oficial: https://act.hoyolab.com/ys/app/interactive-map/index.html',
        ],
    },
    builds: {
        title: 'Builds y optimizacion',
        lines: [
            '• KQM Builds: https://keqingmains.com/',
            '• Calculadora (Aspirine): https://genshin.aspirine.su/',
            '• Optimizer: https://frzyc.github.io/genshin-optimizer/',
        ],
    },
    characters: {
        title: 'Guias de personajes',
        lines: [
            '• KQM Character Guides: https://keqingmains.com/#search',
            '• Honey Hunter (datos): https://genshin.honeyhunterworld.com/',
            '• Wiki personajes: https://genshin-impact.fandom.com/wiki/Character',
            '• Genshin DB API (ES): https://genshin-db-api.vercel.app/api/v5/config?resultLanguage=spanish',
        ],
    },
    map: {
        title: 'Mapa y rutas',
        lines: [
            '• Mapa interactivo oficial: https://act.hoyolab.com/ys/app/interactive-map/index.html',
            '• Mapa alternativo: https://genshin-impact-map.appsample.com/',
        ],
    },
    codes: {
        title: 'Codigos y recompensas',
        lines: [
            '• Canjear codigo: https://genshin.hoyoverse.com/en/gift',
            '• Noticias oficiales: https://www.hoyolab.com/home',
        ],
    },
};

function resolveTopic(raw) {
    const key = String(raw || 'general').trim().toLowerCase();
    if (TOPICS[key]) return key;
    if (key === 'personajes') return 'characters';
    if (key === 'build' || key === 'guia') return 'builds';
    if (key === 'mapa' || key === 'rutas') return 'map';
    if (key === 'codigo' || key === 'codigos') return 'codes';
    return 'general';
}

module.exports = {
    name: 'genshinguide',
    alias: ['gi', 'genshinhelp'],
    Category: genshinCategory,
    usage: 'genshinguide [general|builds|characters|map|codes]',
    description: 'Muestra guias y recursos utiles de Genshin Impact.',
    cooldown: 3,

    async execute(Moxi, message, args) {
        const prefix = await resolveGuildPrefix(Moxi, message);
        const topic = resolveTopic(args?.[0]);
        const data = TOPICS[topic];

        const container = new ContainerBuilder()
            .setAccentColor(0xC39A5B)
            .addTextDisplayComponents(c => c.setContent(`# 🎮 Genshin • ${data.title}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent([
                ...data.lines,
                '',
                `Cuenta (prefix): \`${prefix}genshin\`, \`${prefix}genshinlink\`, \`${prefix}genshinunlink\``,
                `Roster manual: \`${prefix}genshinadd <n1, n2,...>\`, \`${prefix}genshinremove <n1, n2,...>\``,
                `Info rápida: \`${prefix}gidom <texto>\`, \`${prefix}giart <set>\`, \`${prefix}gimat <material>\``,
                'Temas: `general`, `builds`, `characters`, `map`, `codes`',
            ].join('\n')));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
