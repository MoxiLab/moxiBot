const moxi = require('../../i18n');
const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'share',
    alias: ['share'],
    Category: economyCategory,
    usage: 'share <@usuario|id> <cantidad>',
    description: 'commands:CMD_SHARE_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        // “share” = transferir monedas.
        // eslint-disable-next-line global-require
        const give = require('./give');
        const guildId = message.guildId || message.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        return give.execute(Moxi, message, args);
    },
};
