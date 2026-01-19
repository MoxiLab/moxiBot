const moxi = require('../../i18n');
const { buildBagMessage } = require('../../Util/bagView');
const { economyCategory } = require('../../Util/commandCategories');

function safePageArg(arg) {
    const n = Number(arg);
    if (!Number.isFinite(n)) return 0;
    const page1 = Math.max(1, Math.trunc(n));
    return page1 - 1;
}

module.exports = {
    name: 'bag',
    alias: ['mochila', 'inventario', 'inv'],
    Category: economyCategory,
    usage: 'bag [pagina]',
    description: 'commands:CMD_BAG_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const page = args?.[0] ? safePageArg(args[0]) : 0;

        const payload = await buildBagMessage({
            userId: message.author.id,
            viewerId: message.author.id,
            page,
            isPrivate: false,
            lang,
        });

        return message.reply({
            ...payload,
            allowedMentions: { repliedUser: false },
        });
    },
};
