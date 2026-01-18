const moxi = require('../../i18n');
const { buildWipPayload } = require('../../Util/wip');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    name: 'slots',
    alias: ['slots'],
    Category: economyCategory,
    usage: 'slots',
    description: 'Comando en desarrollo.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        return message.reply({
            ...buildWipPayload({
                lang,
                title: 'Slots',
            }),
            allowedMentions: { repliedUser: false },
        });
    },
};
