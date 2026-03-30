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
    name: 'genshinremove',
    alias: ['giremove', 'quitargenshinchar', 'genshincharrm', 'removegenshinchar', 'rmgenshinchar', 'removegichar', 'rmgichar', 'removechar', 'rmchar'],
    Category: genshinCategory,
    usage: 'genshinremove <nombre del personaje>',
    description: 'Elimina un personaje de tu roster manual de Genshin.',
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
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Quitar personaje'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`Uso: \`${prefix}genshinremove <nombre>\` o \`${prefix}genshinremove <n1, n2, n3>\`\nEjemplo: \`${prefix}genshinremove Furina, Navia\``));
            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const doc = await getGlobalUserDoc(message.author.id, message.author.username);
        const roster = buildUniqueRoster(doc?.profile?.genshin?.manualRoster || []);
        const toRemove = new Set();
        const invalid = [];

        for (const name of requested) {
            const rawKey = normalizeCharacterKey(name);
            if (rawKey) toRemove.add(rawKey);

            const meta = await fetchCharacterByQuery(name);
            if (meta?.name) {
                const canonicalKey = normalizeCharacterKey(meta.name);
                if (canonicalKey) toRemove.add(canonicalKey);
            } else {
                invalid.push(name);
            }
        }

        const removed = roster.filter(name => toRemove.has(normalizeCharacterKey(name)));
        const next = roster.filter(name => !toRemove.has(normalizeCharacterKey(name)));

        if (!removed.length) {
            const container = new ContainerBuilder()
                .setAccentColor(0xF1C40F)
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • No encontrado'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent([
                    'No encontré ninguno de esos personajes en tu roster manual.',
                    invalid.length ? `No reconocidos por API: **${invalid.slice(0, 8).join(', ')}**${invalid.length > 8 ? '…' : ''}` : null,
                ].filter(Boolean).join('\n')));
            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        doc.profile.genshin.manualRoster = next;
        doc.profile.genshin.manualRosterUpdatedAt = new Date();
        doc.markModified('profile');
        await doc.save();

        const container = new ContainerBuilder()
            .setAccentColor(0x2ECC71)
            .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Roster actualizado'))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent([
                `✅ Eliminados: **${removed.length}**`,
                `Personajes: **${removed.slice(0, 8).join(', ')}**${removed.length > 8 ? '…' : ''}`,
                invalid.length ? `No reconocidos por API: **${invalid.slice(0, 8).join(', ')}**${invalid.length > 8 ? '…' : ''}` : null,
                `Total en roster manual: **${next.length}**`,
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
