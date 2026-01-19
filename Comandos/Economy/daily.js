const moxi = require('../../i18n');
const { buildWipPayload } = require('../../Util/wip');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'daily',
    alias: ['daily'],
    Category: economyCategory,
    usage: 'daily',
    description: 'economy/daily:WIP_TEXT',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/daily:${k}`, lang, vars);
        return message.reply({
            ...buildWipPayload({
                title: t('TITLE'),
                text: t('WIP_TEXT'),
            }),
            allowedMentions: { repliedUser: false },
        });
    },
};
