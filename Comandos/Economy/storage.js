const moxi = require('../../i18n');
const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'storage',
    alias: ['storage'],
    Category: economyCategory,
    usage: 'storage [pagina]',
    description: 'commands:CMD_STORAGE_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        // “storage” = vista de inventario (bag).
        // eslint-disable-next-line global-require
        const bag = require('./bag');
        const guildId = message.guildId || message.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        return bag.execute(Moxi, message, args);
    },
};
