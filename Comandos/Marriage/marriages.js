const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

module.exports = {
    name: 'marriages',
    alias: ['marriages', 'marriagestatus', 'matrimonios'],
    Category: marriageCategory,
    usage: 'marriages [@usuario]',
    description: 'Ver estado matrimonial de un usuario.',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const target = message.mentions.users.first() || message.author;
        const doc = await getUserDoc(guildId, target.id);

        if (!doc?.marriage?.spouse) {
            return message.reply({ content: `<@${target.id}> no esta casado/a.`, allowedMentions: { repliedUser: false } });
        }

        return message.reply({
            content: `Estado matrimonial\nUsuario: <@${target.id}>\nPareja: <@${doc.marriage.spouse}>\nCasados desde: ${formatDateTag(doc.marriage.marriedAt)}\nAniversario: ${formatDateTag(doc.marriage.anniversaryDate)}`,
            allowedMentions: { repliedUser: false },
        });
    },
};
