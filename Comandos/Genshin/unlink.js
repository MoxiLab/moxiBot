const { ContainerBuilder, MessageFlags } = require('discord.js');
const { genshinCategory } = require('../../Util/commandCategories');
const { getGlobalUserDoc } = require('../../Util/genshinAccount');

module.exports = {
    name: 'genshinunlink',
    alias: ['giunlink', 'desvinculargenshin', 'unlinkgenshin', 'desvinculargi', 'unlinkgi', 'unlinkg', 'unlink', 'desvincular', 'desvinculargi', 'desvinculargenshin'],
    Category: genshinCategory,
    usage: 'genshinunlink',
    description: 'Desvincula tu cuenta de Genshin.',
    cooldown: 3,

    async execute(Moxi, message) {
        const doc = await getGlobalUserDoc(message.author.id, message.author.username);
        const hadUid = Boolean(String(doc?.profile?.genshin?.uid || '').trim());

        doc.profile.genshin = { uid: null, region: null, linkedAt: null };
        doc.markModified('profile');
        await doc.save();

        const container = new ContainerBuilder()
            .setAccentColor(hadUid ? 0x2ECC71 : 0x95A5A6)
            .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Desvincular cuenta'))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(
                hadUid
                    ? '✅ Tu cuenta de Genshin fue desvinculada.'
                    : 'ℹ️ No tenías una cuenta de Genshin vinculada.'
            ));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
