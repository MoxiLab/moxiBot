const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

module.exports = {
    name: 'teammate',
    alias: ['teammate', 'partner', 'spouse'],
    Category: marriageCategory,
    usage: 'teammate [@usuario]',
    description: 'Ver la pareja (teammate) de un usuario casado.',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const target = message.mentions.users.first() || message.author;
        const doc = await getUserDoc(guildId, target.id);

        if (!doc?.marriage?.spouse) {
            return message.reply({ content: `<@${target.id}> no tiene teammate de matrimonio.`, allowedMentions: { repliedUser: false } });
        }

        return message.reply({
            content: `Teammate de <@${target.id}>: <@${doc.marriage.spouse}>\nCasados desde: ${formatDateTag(doc.marriage.marriedAt)}\nAniversario: ${formatDateTag(doc.marriage.anniversaryDate)}`,
            allowedMentions: { repliedUser: false },
        });
    },
};
