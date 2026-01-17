const moxi = require('../../i18n');
const { buildCrimeMessageOptions } = require('../../Util/crimeView');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    name: 'crime',
    alias: ['crimen', 'robo', 'rob', 'steal'],
    Category: economyCategory,
    usage: 'crime',
    description: 'Comete un crimen para intentar ganar monedas (con riesgo).',
    cooldown: Math.floor((5 * 60 * 1000) / 1000),
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
