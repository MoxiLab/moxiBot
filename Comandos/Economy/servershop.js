const moxi = require('../../i18n');
const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'servershop',
    alias: ['servershop'],
    Category: economyCategory,
    usage: 'servershop [categoria] [pagina]',
    description: 'commands:CMD_SERVERSHOP_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        // Por ahora, el “servershop” muestra la tienda normal.
        // eslint-disable-next-line global-require
        const shop = require('./shop');
        const guildId = message.guildId || message.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        return shop.execute(Moxi, message, ['list', ...(Array.isArray(args) ? args : [])]);
    },
};
