const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

module.exports = {
    name: 'proposals',
    alias: ['proposals', 'marriageproposals'],
    Category: marriageCategory,
    usage: 'proposals',
    description: 'Ver tu propuesta de matrimonio pendiente.',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const doc = await getUserDoc(guildId, message.author.id);
        if (!doc?.marriageProposal?.from) {
            return message.reply({ content: 'No tienes propuestas pendientes.', allowedMentions: { repliedUser: false } });
        }

        return message.reply({
            content: `Tienes una propuesta pendiente de <@${doc.marriageProposal.from}>.\nCreada: ${formatDateTag(doc.marriageProposal.createdAt)}\nAniversario: ${formatDateTag(doc.marriageProposal.anniversaryDate)}`,
            allowedMentions: { repliedUser: false },
        });
    },
};
