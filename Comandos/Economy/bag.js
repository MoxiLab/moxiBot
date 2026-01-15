const moxi = require('../../i18n');
const { buildBagMessage } = require('../../Util/bagView');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

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
    description: 'Muestra tu mochila (inventario).',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const page = args?.[0] ? safePageArg(args[0]) : 0;

        const payload = await buildBagMessage({
            userId: message.author.id,
            viewerId: message.author.id,
            page,
            isPrivate: false,
        });

        return message.reply({
            ...payload,
            allowedMentions: { repliedUser: false },
        });
    },
};
