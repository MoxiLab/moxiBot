const moxi = require('../../i18n');
const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'slots',
    alias: ['slots'],
    Category: economyCategory,
    usage: 'slots <cantidad|all> <rojo|negro|par|impar|alto|bajo|docena1|docena2|docena3|0-36>',
    description: 'commands:CMD_SLOTS_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        // Por compatibilidad, “slots” redirige al minijuego de ruleta.
        // eslint-disable-next-line global-require
        const roulette = require('./roulette');
        const guildId = message.guildId || message.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        return roulette.execute(Moxi, message, args);
    },
};
