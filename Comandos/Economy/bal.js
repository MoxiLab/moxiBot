const moxi = require('../../i18n');
const { buildBalanceMessage } = require('../../Util/balanceView');
const { economyCategory } = require('../../Util/commandCategories');
module.exports = {
    name: 'bal',
    alias: ['balance', 'saldo'],
    Category: economyCategory,
    usage: 'bal [@usuario] | balance [@usuario]',
    description: 'commands:CMD_BAL_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const target =
            message.mentions?.users?.first?.() ||
            (args?.[0] ? await Moxi.users.fetch(args[0]).catch(() => null) : null) ||
            message.author;

        const payload = await buildBalanceMessage({ guildId, lang, viewerId: message.author.id, targetUser: target });
        return message.reply(payload);
    },
};
