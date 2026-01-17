const moxi = require('../../i18n');
const { buildWipPayload } = require('../../Util/wip');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    name: 'repair',
    alias: [],
    Category: economyCategory,
    usage: 'repair',
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
                title: 'Repair',
                text: 'Este comando aún está en desarrollo. Lo añadiremos pronto.',
            }),
            allowedMentions: { repliedUser: false },
        });
    },
};
