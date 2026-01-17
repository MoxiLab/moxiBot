const moxi = require('../../i18n');
const { buildMoxidexMessage } = require('../../Util/moxidexView');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    name: 'moxidex',
    // Mantener compatibilidad con el nombre antiguo
    alias: ['nekodex', 'dex', 'moxi-dex'],
    Category: economyCategory,
    usage: 'moxidex',
    description: 'Muestra tu Moxidex (mascotas).',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const payload = await buildMoxidexMessage({
            userId: message.author.id,
            viewerId: message.author.id,
            tierKey: 'all',
            sort: 'new',
            page: 0,
            lang,
        });

        return message.reply({
            ...payload,
            allowedMentions: { repliedUser: false },
        });
    },
};
