const moxi = require('../../i18n');
const { buildWipPayload } = require('../../Util/wip');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'servershop',
    alias: ['servershop'],
    Category: economyCategory,
    usage: 'servershop',
    description: 'misc:WIP_TEXT',
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
                title: 'Servershop',
            }),
            allowedMentions: { repliedUser: false },
        });
    },
};
