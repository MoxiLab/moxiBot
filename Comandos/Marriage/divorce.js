const { marriageCategory } = require('../../Util/commandCategories');
const { divorce } = require('../../Util/marriageCore');

module.exports = {
    name: 'divorce',
    alias: ['divorce', 'divorcio'],
    Category: marriageCategory,
    usage: 'divorce',
    description: 'Divorciarte de tu pareja.',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const res = await divorce({ guildId, userId: message.author.id });
        if (!res.ok) {
            return message.reply({ content: res.message, allowedMentions: { repliedUser: false } });
        }

        return message.reply({
            content: `Te divorciaste de <@${res.spouseId}>.`,
            allowedMentions: { repliedUser: false },
        });
    },
};
