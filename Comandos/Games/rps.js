const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { gamesCategory } = require('../../Util/commandCategories');
const { buildRpsMessageOptions } = require('../../Util/rpsGame');

module.exports = {
    name: 'rps',
    alias: ['rps', 'ppt', 'piedrapapeltijera'],
    Category: gamesCategory,
    usage: 'rps',
    description: 'commands:CMD_RPS_DESC',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        try {
            return message.reply({
                ...buildRpsMessageOptions({ userId: message.author?.id, lang }),
                allowedMentions: { repliedUser: false },
            });
        } catch {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({
                    emoji: '🕹️',
                    title: 'RPS',
                    text: 'No pude iniciar el juego ahora mismo.',
                })),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
