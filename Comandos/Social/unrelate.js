const { marriageCategory } = require('../../Util/commandCategories');
const { removeRelationship, getGlobalUserDoc } = require('../../Util/relationshipCore');

module.exports = {
    name: 'unrelate',
    alias: ['unrelate', 'quitarrelacion', 'desvincular'],
    Category: marriageCategory,
    usage: 'unrelate @usuario',
    description: 'Eliminar una relación con otro usuario.',
    cooldown: 3,

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const target = message.mentions.users.first();
        if (!target) {
            return message.reply({ content: 'Menciona al usuario cuya relación quieres eliminar.\nUso: `-unrelate @usuario`', allowedMentions: { repliedUser: false } });
        }

        const doc = await getGlobalUserDoc(message.author.id, message.author.username);
        if (!doc) {
            return message.reply({ content: 'No tienes ninguna relación registrada.', allowedMentions: { repliedUser: false } });
        }

        const res = await removeRelationship(doc, target.id);
        if (!res.ok) {
            return message.reply({ content: res.message, allowedMentions: { repliedUser: false } });
        }

        return message.reply({
            content: `Eliminaste tu relación con <@${target.id}>.`,
            allowedMentions: { repliedUser: false }
        });
    },
};
