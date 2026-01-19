/*
  Genera comandos "stub" (WIP) para los nombres de la lista que faltan.
  - Prefijo: Comandos/Economy/<name>.js (excepto los que ya existan)
  - Slash:   Slashcmd/Economy/<name>.js (excepto los que ya existan)
  - Slash rank: Slashcmd/Tools/rank.js (wrapper al comando existente)

  Uso:
    node scripts/generate_missing_commands_from_list.js
*/

const fs = require('fs');
const path = require('path');

const prefixMissing = [
    'balance',
    'carnival',
    'chop',
    'claimcode',
    'collect',
    'daily',
    'event',
    'fortune',
    'gift',
    'give',
    'guide',
    'iteminfo',
    'leaderboard',
    'market',
    'mix',
    'nekodex',
    'nekoshop',
    'pet',
    'profile',
    'quest',
    'race',
    'repair',
    'sell',
    'servershop',
    'settings',
    'share',
    'slots',
    'storage',
    'trade',
    'xmas',
];

const slashMissing = [
    'carnival',
    'chop',
    'claimcode',
    'collect',
    'craft',
    'daily',
    'event',
    'fortune',
    'gift',
    'give',
    'guide',
    'iteminfo',
    'leaderboard',
    'market',
    'mix',
    'nekodex',
    'nekoshop',
    'pet',
    'profile',
    'quest',
    'race',
    'repair',
    'sell',
    'servershop',
    'settings',
    'share',
    'slots',
    'storage',
    'trade',
    'xmas',
];

function ensureDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

function titleFromName(name) {
    return String(name || '').trim().replace(/^\w/, (c) => c.toUpperCase());
}

function writeIfMissing(filePath, content) {
    if (fs.existsSync(filePath)) return false;
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
}

function makePrefixStub(name) {
    const t = titleFromName(name);
    return `const moxi = require('../../i18n');
const { buildWipPayload } = require('../../Util/wip');

function economyCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
}

module.exports = {
    name: '${name}',
    alias: ['${name}'],
    Category: economyCategory,
    usage: '${name}',
    description: 'Comando en desarrollo.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        return message.reply({
            ...buildWipPayload({
                title: '${t}',
                text: 'Este comando aún está en desarrollo. Lo añadiremos pronto.',
            }),
            allowedMentions: { repliedUser: false },
        });
    },
};
`;
}

function makePrefixBalanceWrapper() {
    return `const moxi = require('../../i18n');
const { buildBalanceMessage } = require('../../Util/balanceView');

function economyCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
}

module.exports = {
    name: 'balance',
    alias: ['balance'],
    Category: economyCategory,
    usage: 'balance [@usuario]',
    description: 'Muestra tu balance (coins/banco/sakuras).',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const target =
            message.mentions?.users?.first?.() ||
            (args?.[0] ? await Moxi.users.fetch(args[0]).catch(() => null) : null) ||
            message.author;

        const payload = await buildBalanceMessage({ guildId, lang, viewerId: message.author.id, targetUser: target });
        return message.reply(payload);
    },
};
`;
}

function makeSlashStub(name) {
    const t = titleFromName(name);
    return `const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildWipPayload } = require('../../Util/wip');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('${name}')
        .setDescription('Comando en desarrollo'),

    async run(Moxi, interaction) {
        return interaction.reply({
            ...buildWipPayload({
                title: '${t}',
                text: 'Este comando aún está en desarrollo. Lo añadiremos pronto.',
            }),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
`;
}

function makeSlashRankWrapper() {
    return `const { SlashCommandBuilder, ApplicationCommandOptionType } = require('discord.js');
const moxi = require('../../i18n');

const rankCmd = require('../../Comandos/Utiility/Rank');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Muestra tu tarjeta de rango actual')
        .addUserOption((opt) =>
            opt
                .setName('usuario')
                .setDescription('Usuario para ver el rango (opcional)')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        // Reusar la implementación existente (interactionRun)
        if (typeof rankCmd?.interactionRun === 'function') {
            return rankCmd.interactionRun(Moxi, interaction);
        }
        // fallback: si cambia la estructura
        if (typeof rankCmd?.run === 'function') {
            return rankCmd.run(Moxi, interaction);
        }
        throw new Error('rank: no hay handler de interacción disponible');
    },
};
`;
}

function main() {
    const root = process.cwd();
    let created = 0;

    for (const name of prefixMissing) {
        const file = path.join(root, 'Comandos', 'Economy', `${name}.js`);
        const content = name === 'balance' ? makePrefixBalanceWrapper() : makePrefixStub(name);
        if (writeIfMissing(file, content)) created++;
    }

    for (const name of slashMissing) {
        const file = path.join(root, 'Slashcmd', 'Economy', `${name}.js`);
        if (writeIfMissing(file, makeSlashStub(name))) created++;
    }

    // rank: Tools (no Economy)
    const rankFile = path.join(root, 'Slashcmd', 'Tools', 'rank.js');
    if (writeIfMissing(rankFile, makeSlashRankWrapper())) created++;

    console.log('created files:', created);
}

main();
