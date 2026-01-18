const moxi = require('../../i18n');
const { buildWipPayload } = require('../../Util/wip');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    name: 'claimcode',
    alias: ['claimcode'],
    Category: economyCategory,
    usage: 'claimcode',
    description: 'Comando en desarrollo.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        return message.reply({
            ...buildWipPayload({
                title: 'Claimcode',
                text: 'Este comando aún está en desarrollo. Lo añadiremos pronto.',
            }),
            allowedMentions: { repliedUser: false },
        });
    },
};
