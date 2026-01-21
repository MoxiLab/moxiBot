const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'coinflip',
    alias: ['coinflip', 'flip', 'coin'],
    Category: economyCategory,
    usage: 'coinflip',
    description: 'commands:CMD_COINFLIP_DESC',
    cooldown: 0,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const isHeads = Math.random() < 0.5;
        const result = isHeads
            ? (moxi.translate('FUN_COINFLIP_HEADS', lang) || 'Cara')
            : (moxi.translate('FUN_COINFLIP_TAILS', lang) || 'Cruz');

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🪙',
                    title: moxi.translate('FUN_COINFLIP_TITLE', lang) || 'Coinflip',
                    text: moxi.translate('FUN_COINFLIP_RESULT', lang, { result }) || result,
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
