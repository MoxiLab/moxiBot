const { marriageCategory } = require('../../Util/commandCategories');
const { declineProposal } = require('../../Util/marriageCore');

module.exports = {
    name: 'declinemarriage',
    alias: ['declinemarriage', 'declinem'],
    Category: marriageCategory,
    usage: 'declinemarriage [@proponente]',
    description: 'Rechazar una propuesta de matrimonio pendiente.',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const proposerId = message.mentions.users.first()?.id || null;
        const res = await declineProposal({ guildId, targetUserId: message.author.id, proposerId });

        if (!res.ok) {
            return message.reply({ content: res.message, allowedMentions: { repliedUser: false } });
        }

        return message.reply({
            content: `Rechazaste la propuesta de <@${res.proposerId}>.`,
            allowedMentions: { repliedUser: false },
        });
    },
};
