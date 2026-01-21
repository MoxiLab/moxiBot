const moxi = require('../../i18n');
const { economyCategory } = require('../../Util/commandCategories');


module.exports = {
    name: 'mix',
    alias: ['mix'],
    Category: economyCategory,
    usage: 'mix <receta> | mix list [-p pagina]',
    description: 'commands:CMD_MIX_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        // “mix” actúa como alias de craft.
        // eslint-disable-next-line global-require
        const craft = require('./craft');
        const guildId = message.guildId || message.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        return craft.execute(Moxi, message, args);
    },
};
