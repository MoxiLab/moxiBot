const { ContainerBuilder, MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { genshinCategory } = require('../../Util/commandCategories');

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

module.exports = {
    cooldown: 3,
    Category: genshinCategory,
    data: new SlashCommandBuilder()
        .setName('genshin')
        .setDescription('Muestra guias y recursos utiles de Genshin Impact.')
        .addStringOption((opt) =>
            opt.setName('tema')
                .setDescription('Tema de la guia')
                .setRequired(false)
                .addChoices(
                    { name: 'General', value: 'general' },
                    { name: 'Builds', value: 'builds' },
                    { name: 'Characters', value: 'characters' },
                    { name: 'Map', value: 'map' },
                    { name: 'Codes', value: 'codes' }
                )
        )
        .setDMPermission(true),

    async run(Moxi, interaction) {
        const topic = interaction.options.getString('tema', false) || 'general';
        const data = TOPICS[topic] || TOPICS.general;

        const container = new ContainerBuilder()
            .setAccentColor(0xC39A5B)
            .addTextDisplayComponents(c => c.setContent(`# 🎮 Genshin • ${data.title}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent([
                ...data.lines,
                '',
                'Temas: `general`, `builds`, `characters`, `map`, `codes`',
            ].join('\n')));

        return interaction.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
