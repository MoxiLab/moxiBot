const moxi = require('../../i18n');
const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'trade',
    alias: ['trade'],
    Category: economyCategory,
    usage: 'trade <@usuario|id> <cantidad>',
    description: 'commands:CMD_TRADE_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        // “trade” por ahora equivale a transferir monedas (give).
        // eslint-disable-next-line global-require
        const give = require('./give');
        const guildId = message.guildId || message.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        return give.execute(Moxi, message, args);
    },
};
