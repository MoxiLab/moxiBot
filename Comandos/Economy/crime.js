const moxi = require('../../i18n');
const { buildCrimeMessageOptions } = require('../../Util/crimeView');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'crime',
    alias: ['crimen', 'robo', 'rob', 'steal'],
    Category: economyCategory,
    usage: 'crime',
    description: 'commands:CMD_CRIME_DESC',
    cooldown: 0,
    examples: ['crime'],
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const userId = message.author?.id;

        const payload = buildCrimeMessageOptions({ lang, userId });
        return message.reply(payload);
    },
};
