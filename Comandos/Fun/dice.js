const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { funCategory } = require('../../Util/commandCategories');

function clampInt(n, min, max) {
    const v = Number.parseInt(String(n), 10);
    if (!Number.isFinite(v)) return null;
    return Math.min(max, Math.max(min, v));
}

module.exports = {
    name: 'dice',
    alias: ['dice', 'dado', 'dados', 'roll'],
    Category: funCategory,
    usage: 'dice [lados]',
    description: 'commands:CMD_DICE_DESC',
    cooldown: 0,

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const rawSides = Array.isArray(args) && args[0] ? args[0] : 6;
        const sides = clampInt(rawSides, 2, 100);

        if (!sides) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🎲',
                        title: moxi.translate('FUN_DICE_TITLE', lang) || 'Dado',
                        text: moxi.translate('FUN_DICE_INVALID_SIDES', lang) || 'El número de lados debe ser un entero entre 2 y 100.',
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const roll = 1 + Math.floor(Math.random() * sides);

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🎲',
                    title: moxi.translate('FUN_DICE_TITLE', lang) || 'Dado',
                    text: moxi.translate('FUN_DICE_RESULT', lang, { roll, sides }) || `Resultado: ${roll}/${sides}`,
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
