const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag } = require('../../Util/marriageCore');

module.exports = {
    name: 'tree',
    alias: ['tree', 'marriagetree', 'familytree'],
    Category: marriageCategory,
    usage: 'tree [@usuario]',
    description: 'Mostrar arbol de pareja del matrimonio.',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const target = message.mentions.users.first() || message.author;
        const doc = await getUserDoc(guildId, target.id);

        if (!doc?.marriage?.spouse) {
            return message.reply({ content: `<@${target.id}> no esta casado/a.`, allowedMentions: { repliedUser: false } });
        }

        const tree = [
            `        <@${target.id}>`,
            '             |',
            `        <@${doc.marriage.spouse}>`,
        ].join('\n');

        return message.reply({
            content: `Arbol de matrimonio\n\n${tree}\n\nCasados desde: ${formatDateTag(doc.marriage.marriedAt)}`,
            allowedMentions: { repliedUser: false },
        });
    },
};
