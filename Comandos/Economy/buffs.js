const moxi = require('../../i18n');
const { buildBuffsMessage } = require('../../Util/buffsView');
const { economyCategory } = require('../../Util/commandCategories');
module.exports = {
    name: 'buffs',
    alias: ['potenciadores', 'boosts'],
    Category: economyCategory,
    usage: 'buffs',
    description: 'commands:CMD_BUFFS_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const payload = await buildBuffsMessage({ guildId, lang, userId: message.author.id });

        return message.reply({
            ...payload,
            allowedMentions: { repliedUser: false },
        });
    },
};
