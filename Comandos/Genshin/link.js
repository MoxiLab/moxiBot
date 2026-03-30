const { ContainerBuilder, MessageFlags } = require('discord.js');
const { genshinCategory } = require('../../Util/commandCategories');
const {
    normalizeUid,
    normalizeRegion,
    detectRegionFromUid,
    getGlobalUserDoc,
} = require('../../Util/genshinAccount');

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
    name: 'genshinlink',
    alias: ['gilink', 'vinculargenshin', 'linkgenshin', 'vinculargi', 'linkgi', 'linkg', 'link'],
    Category: genshinCategory,
    usage: 'genshinlink <uid> [EU|NA|ASIA|SAR]',
    description: 'Vincula tu cuenta de Genshin por UID (sin login).',
    cooldown: 3,

    async execute(Moxi, message, args) {
        const prefix = await resolveGuildPrefix(Moxi, message);
        const uid = normalizeUid(args?.[0]);
        if (!uid) {
            const container = new ContainerBuilder()
                .setAccentColor(0xE74C3C)
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Vincular cuenta'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`Uso: \`${prefix}genshinlink <uid> [EU|NA|ASIA|SAR]\`\nEjemplo: \`${prefix}genshinlink 700123456 EU\``));
            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const explicitRegion = normalizeRegion(args?.[1]);
        const detectedRegion = detectRegionFromUid(uid);
        const region = explicitRegion || detectedRegion;

        if (!region) {
            const container = new ContainerBuilder()
                .setAccentColor(0xF39C12)
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Región no detectada'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent('No pude detectar la región por UID. Indícala manualmente: `EU`, `NA`, `ASIA` o `SAR`.'));
            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const doc = await getGlobalUserDoc(message.author.id, message.author.username);
        doc.profile.genshin.uid = uid;
        doc.profile.genshin.region = region;
        doc.profile.genshin.linkedAt = new Date();
        doc.markModified('profile');
        await doc.save();

        const container = new ContainerBuilder()
            .setAccentColor(0x2ECC71)
            .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Cuenta vinculada'))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(`✅ Cuenta de Genshin vinculada.\nUID: **${uid}**\nRegión: **${region}**`));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
