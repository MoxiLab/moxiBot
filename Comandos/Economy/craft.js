const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    name: 'craft',
    alias: ['forge', 'craftear'],
    Category: economyCategory,
    usage: 'craft [-p página] <item> [anvil]',
    description: 'Crea items o revisa la lista.',
    cooldown: 0,
    examples: ['craft', 'craft -p 2', 'craft barra de oro', 'craft nyan -o', 'craft --steel --acero -s -a'],
    permissions: {
        Bot: ['Ver canal', 'Enviar mensajes', 'Insertar enlaces'],
        User: [],
    },
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');

        return message.reply(
            asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🛠️',
                    title: 'Craft',
                    text: `Sistema de craft (demo).\nEj: \`${prefix}craft -p 2\` o \`${prefix}craft barra de oro\`.`,
                })
            )
        );
    },
};
