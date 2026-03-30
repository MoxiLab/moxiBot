const { marriageCategory } = require('../../Util/commandCategories');
const { acceptProposal } = require('../../Util/marriageCore');

module.exports = {
    name: 'acceptmarriage',
    alias: ['acceptmarriage', 'acceptm'],
    Category: marriageCategory,
    usage: 'acceptmarriage [@proponente]',
    description: 'Aceptar una propuesta de matrimonio pendiente.',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const proposerId = message.mentions.users.first()?.id || null;
        const res = await acceptProposal({ guildId, targetUserId: message.author.id, proposerId });

        if (!res.ok) {
            return message.reply({ content: res.message, allowedMentions: { repliedUser: false } });
        }

        return message.reply({
            content: `Aceptaste la propuesta de <@${res.proposerId}>. Felicidades por su matrimonio.`,
            allowedMentions: { repliedUser: false },
        });
    },
};
