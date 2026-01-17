const moxi = require('../../i18n');
const { buildBuffsMessage } = require('../../Util/buffsView');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    name: 'buffs',
    alias: ['potenciadores', 'boosts'],
    Category: economyCategory,
    usage: 'buffs',
    description: 'Muestra tus potenciadores y bonos de botín.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const payload = await buildBuffsMessage({ guildId, lang, userId: message.author.id });

        return message.reply({
            ...payload,
            allowedMentions: { repliedUser: false },
        });
    },
};
