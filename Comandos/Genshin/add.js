const { ContainerBuilder, MessageFlags } = require('discord.js');
const { genshinCategory } = require('../../Util/commandCategories');
const { getGlobalUserDoc } = require('../../Util/genshinAccount');
const {
    sanitizeCharacterName,
    normalizeCharacterKey,
    buildUniqueRoster,
} = require('../../Util/genshinRoster');
const { fetchCharacterByQuery } = require('../../Util/genshinDbProxy');

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

module.exports = {
    name: 'genshinadd',
    alias: ['giadd', 'agregargenshinchar', 'genshincharadd'],
    Category: genshinCategory,
    usage: 'genshinadd <nombre del personaje>',
    description: 'Agrega un personaje a tu roster manual de Genshin.',
    cooldown: 2,

    async execute(Moxi, message, args) {
        const prefix = await resolveGuildPrefix(Moxi, message);
        const rawInput = String(args?.join(' ') || '').trim();
        const requested = rawInput
            .split(',')
            .map(part => sanitizeCharacterName(part))
            .filter(Boolean);

        if (!requested.length) {
            const container = new ContainerBuilder()
                .setAccentColor(0xE67E22)
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Agregar personaje'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`Uso: \`${prefix}genshinadd <nombre>\` o \`${prefix}genshinadd <n1, n2, n3>\`\nEjemplo: \`${prefix}genshinadd Furina, Arlecchino, Navia\``));
            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const doc = await getGlobalUserDoc(message.author.id, message.author.username);
        const roster = buildUniqueRoster(doc?.profile?.genshin?.manualRoster || []);
        const existing = new Set(roster.map(name => normalizeCharacterKey(name)));

        const added = [];
        const duplicates = [];
        const invalid = [];
        for (const rawName of requested) {
            const meta = await fetchCharacterByQuery(rawName);
            if (!meta?.name) {
                invalid.push(rawName);
                continue;
            }

            const canonicalName = sanitizeCharacterName(meta.name);
            const key = normalizeCharacterKey(canonicalName);
            if (!key || existing.has(key)) {
                duplicates.push(canonicalName || rawName);
                continue;
            }

            existing.add(key);
            roster.push(canonicalName);
            added.push(canonicalName);
        }

        if (!added.length) {
            const container = new ContainerBuilder()
                .setAccentColor(0xF1C40F)
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Ya existe'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent([
                    'No se pudo agregar ninguno de los nombres enviados.',
                    duplicates.length ? `Ya estaban en tu roster: **${duplicates.slice(0, 8).join(', ')}**${duplicates.length > 8 ? '…' : ''}` : null,
                    invalid.length ? `No reconocidos por API: **${invalid.slice(0, 8).join(', ')}**${invalid.length > 8 ? '…' : ''}` : null,
                ].filter(Boolean).join('\n')));
            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        doc.profile.genshin.manualRoster = buildUniqueRoster(roster);
        doc.profile.genshin.manualRosterUpdatedAt = new Date();
        doc.markModified('profile');
        await doc.save();

        const duplicateLine = duplicates.length
            ? `\nOmitidos por duplicado: **${duplicates.slice(0, 8).join(', ')}**${duplicates.length > 8 ? '…' : ''}`
            : '';
        const invalidLine = invalid.length
            ? `\nNo reconocidos por API: **${invalid.slice(0, 8).join(', ')}**${invalid.length > 8 ? '…' : ''}`
            : '';

        const container = new ContainerBuilder()
            .setAccentColor(0x2ECC71)
            .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Roster actualizado'))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent([
                `✅ Añadidos: **${added.length}**`,
                `Personajes: **${added.slice(0, 8).join(', ')}**${added.length > 8 ? '…' : ''}`,
                duplicateLine,
                invalidLine,
                `Total en roster manual: **${doc.profile.genshin.manualRoster.length}**`,
                `Puedes verlo con: \`${prefix}genshin\``,
            ].filter(Boolean).join('\n')));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
