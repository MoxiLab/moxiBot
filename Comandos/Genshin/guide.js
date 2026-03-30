const { ContainerBuilder, MessageFlags } = require('discord.js');
const { genshinCategory } = require('../../Util/commandCategories');
const { normalizeCharacterKey } = require('../../Util/genshinRoster');

const GUIDES = [
    {
        name: 'Raiden Shogun',
        aliases: ['raiden', 'ei'],
        roles: ['Bateria', 'Sub-DPS', 'Driver'],
        partners: ['Bennett', 'Xiangling', 'Xingqiu/Yelan', 'Sara C6', 'Kazuha', 'Chevreuse'],
        teams: [
            { name: 'Raiden National', members: ['Raiden', 'Xiangling', 'Xingqiu/Yelan', 'Bennett'] },
            { name: 'Hypercarry Raiden', members: ['Raiden', 'Sara', 'Kazuha', 'Bennett'] },
            { name: 'Overload Raiden', members: ['Raiden', 'Chevreuse', 'Bennett', 'Xiangling'] },
        ],
    },
    {
        name: 'Neuvillette',
        aliases: ['neuv'],
        roles: ['Main DPS'],
        partners: ['Furina', 'Kazuha', 'Baizhu', 'Zhongli', 'Fischl'],
        teams: [
            { name: 'Neuvillette Premium', members: ['Neuvillette', 'Furina', 'Kazuha', 'Baizhu/Zhongli'] },
            { name: 'Neuvillette Hyperbloom', members: ['Neuvillette', 'Nahida', 'Kuki', 'Furina/Yelan'] },
        ],
    },
    {
        name: 'Hu Tao',
        aliases: ['hutao'],
        roles: ['Main DPS'],
        partners: ['Xingqiu', 'Yelan', 'Zhongli', 'Furina', 'Xianyun'],
        teams: [
            { name: 'Double Hydro', members: ['Hu Tao', 'Xingqiu', 'Yelan', 'Zhongli'] },
            { name: 'Furina Tao', members: ['Hu Tao', 'Furina', 'Yelan/Xingqiu', 'Xianyun/Jean'] },
        ],
    },
    {
        name: 'Arlecchino',
        aliases: ['arle'],
        roles: ['Main DPS'],
        partners: ['Bennett', 'Kazuha', 'Yelan', 'Xingqiu', 'Zhongli'],
        teams: [
            { name: 'Vape Arlecchino', members: ['Arlecchino', 'Yelan/Xingqiu', 'Bennett', 'Kazuha'] },
            { name: 'Mono Pyro', members: ['Arlecchino', 'Bennett', 'Xiangling', 'Kazuha'] },
        ],
    },
    {
        name: 'Navia',
        aliases: [],
        roles: ['Main DPS'],
        partners: ['Zhongli', 'Bennett', 'Furina', 'Xiangling', 'Fischl'],
        teams: [
            { name: 'Navia Double Geo', members: ['Navia', 'Zhongli', 'Bennett', 'Furina/Xiangling'] },
            { name: 'Navia Quickswap', members: ['Navia', 'Albedo/Chiori', 'Bennett', 'Fischl'] },
        ],
    },
    {
        name: 'Alhaitham',
        aliases: ['haitham'],
        roles: ['Main DPS', 'Driver'],
        partners: ['Nahida', 'Kuki', 'Yelan/Xingqiu', 'Fischl'],
        teams: [
            { name: 'Quickbloom', members: ['Alhaitham', 'Nahida', 'Kuki', 'Yelan/Xingqiu'] },
            { name: 'Spread', members: ['Alhaitham', 'Nahida', 'Fischl', 'Zhongli'] },
        ],
    },
    {
        name: 'Nahida',
        aliases: [],
        roles: ['Support', 'Sub-DPS', 'Driver'],
        partners: ['Alhaitham', 'Kuki', 'Raiden', 'Yelan', 'Nilou'],
        teams: [
            { name: 'Hyperbloom Core', members: ['Nahida', 'Hydro', 'Electro', 'Flex'] },
            { name: 'Nilou Bloom', members: ['Nahida', 'Nilou', 'Kokomi/Barbara', 'Dendro'] },
        ],
    },
    {
        name: 'Furina',
        aliases: [],
        roles: ['Sub-DPS', 'Buffer'],
        partners: ['Neuvillette', 'Xianyun', 'Jean', 'Baizhu', 'Yelan'],
        teams: [
            { name: 'Neuvillette Core', members: ['Neuvillette', 'Furina', 'Kazuha', 'Baizhu/Zhongli'] },
            { name: 'Furina Plunge', members: ['DPS', 'Furina', 'Xianyun', 'Flex'] },
        ],
    },
    {
        name: 'Kazuha',
        aliases: [],
        roles: ['Support', 'Buffer'],
        partners: ['Bennett', 'Furina', 'Raiden', 'Ayaka', 'Childe'],
        teams: [
            { name: 'Anemo Buffer', members: ['DPS elemental', 'Kazuha', 'Aplicador', 'Healer/Shielder'] },
            { name: 'International', members: ['Childe', 'Xiangling', 'Bennett', 'Kazuha'] },
        ],
    },
    {
        name: 'Ayaka',
        aliases: ['kamisato ayaka'],
        roles: ['Main DPS'],
        partners: ['Shenhe', 'Kazuha', 'Kokomi', 'Mona', 'Diona'],
        teams: [
            { name: 'Freeze Premium', members: ['Ayaka', 'Shenhe', 'Kazuha', 'Kokomi'] },
            { name: 'Freeze F2P', members: ['Ayaka', 'Rosaria', 'Sucrose', 'Barbara'] },
        ],
    },
    {
        name: 'Xiao',
        aliases: [],
        roles: ['Main DPS'],
        partners: ['Faruzan', 'Xianyun', 'Bennett', 'Zhongli'],
        teams: [
            { name: 'Xiao Hypercarry', members: ['Xiao', 'Faruzan', 'Xianyun', 'Bennett/Zhongli'] },
        ],
    },
    {
        name: 'Wanderer',
        aliases: ['scaramouche', 'scara'],
        roles: ['Main DPS'],
        partners: ['Faruzan', 'Bennett', 'Furina', 'Zhongli', 'Thoma'],
        teams: [
            { name: 'Wanderer Carry', members: ['Wanderer', 'Faruzan', 'Bennett', 'Zhongli/Thoma'] },
        ],
    },
];

function buildGuideIndex() {
    const map = new Map();
    for (const guide of GUIDES) {
        const keys = [guide.name, ...(guide.aliases || [])];
        for (const key of keys) {
            const norm = normalizeCharacterKey(key);
            if (norm) map.set(norm, guide);
        }
    }
    return map;
}

const GUIDE_INDEX = buildGuideIndex();

function findGuide(query) {
    const q = normalizeCharacterKey(query);
    if (!q) return null;
    if (GUIDE_INDEX.has(q)) return GUIDE_INDEX.get(q);

    for (const [k, guide] of GUIDE_INDEX.entries()) {
        if (k.includes(q)) return guide;
    }
    return null;
}

module.exports = {
    name: 'guide',
    alias: ['guia', 'giguia', 'team', 'equipo', 'comp', 'teamcomp'],
    Category: genshinCategory,
    usage: 'guia <personaje>',
    description: 'Guia rapida de equipos recomendados para un personaje.',
    cooldown: 2,

    async execute(Moxi, message, args) {
        const query = String(args?.join(' ') || '').trim();

        if (!query) {
            const examples = GUIDES.slice(0, 8).map(g => g.name).join(', ');
            const container = new ContainerBuilder()
                .setAccentColor(0x6AA6FF)
                .addTextDisplayComponents(c => c.setContent('# Guia de Equipos'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    `Uso: .giguia <personaje>\nEjemplo: .giguia raiden\n\nDisponibles: ${examples}`
                ));

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const guide = findGuide(query);
        if (!guide) {
            const examples = GUIDES.slice(0, 10).map(g => g.name).join(', ');
            const container = new ContainerBuilder()
                .setAccentColor(0xE67E22)
                .addTextDisplayComponents(c => c.setContent('# Guia no encontrada'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    `No encontre guia para **${query}**.\n\nPrueba con: ${examples}`
                ));

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const teamLines = guide.teams
            .map((t, i) => `${i + 1}. **${t.name}**\n   ${t.members.join(' • ')}`)
            .join('\n\n');

        const container = new ContainerBuilder()
            .setAccentColor(0x6AA6FF)
            .addTextDisplayComponents(c => c.setContent(`# ${guide.name} • Guia rapida`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent([
                `**Rol:** ${guide.roles.join(', ')}`,
                `**Buenas sinergias:** ${guide.partners.join(', ')}`,
                '',
                '**Equipos recomendados:**',
                teamLines,
            ].join('\n')));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
