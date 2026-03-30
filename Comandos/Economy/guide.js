const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { economyCategory } = require('../../Util/commandCategories');
module.exports = {
    name: 'guide',
    alias: ['guide'],
    Category: economyCategory,
    usage: 'guide',
    description: 'commands:CMD_GUIDE_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');
        const t = (k, vars = {}) => moxi.translate(`economy/guide:${k}`, lang, vars);

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.info || 'ℹ️',
                    title: t('TITLE'),
                    text: t('BODY', { prefix }),
                    footerText: t('FOOTER', { prefix }),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
