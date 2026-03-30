const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

function stripMentionTokens(args) {
    return (args || []).filter((a) => !/^<@!?\d+>$/.test(String(a || '')));
}

module.exports = {
    name: 'letter',
    alias: ['letter', 'marriageletter'],
    Category: marriageCategory,
    usage: 'letter [@pareja] <mensaje>',
    description: 'Enviar una carta de amor a tu pareja.',
    cooldown: 0,

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const authorDoc = await getUserDoc(guildId, message.author.id);
        if (!authorDoc?.marriage?.spouse) {
            return message.reply({ content: 'No estas casado/a.', allowedMentions: { repliedUser: false } });
        }

        const spouseId = String(authorDoc.marriage.spouse);
        const mentioned = message.mentions.users.first();
        const targetId = mentioned ? String(mentioned.id) : spouseId;

        if (targetId !== spouseId) {
            return message.reply({ content: 'Solo puedes enviar letter a tu pareja.', allowedMentions: { repliedUser: false } });
        }

        const text = stripMentionTokens(args).join(' ').trim();
        if (!text) {
            return message.reply({ content: 'Escribe un mensaje. Ejemplo: letter Te amo mucho.', allowedMentions: { repliedUser: false } });
        }

        const annText = formatDateTag(authorDoc.marriage.anniversaryDate);
        return message.reply({
            content: `Carta para <@${spouseId}>\nDe: <@${message.author.id}>\nAniversario: ${annText}\n\n${text}`,
            allowedMentions: { repliedUser: false },
        });
    },
};
