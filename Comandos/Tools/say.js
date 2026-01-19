const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { toolsCategory } = require('../../Util/commandCategories');

async function safeDeleteMessage(message) {
    try {
        if (!message?.deletable) return false;
        await message.delete();
        return true;
    } catch {
        return false;
    }
}


module.exports = {
    name: 'say',
    alias: ['decir'],
    Category: toolsCategory,
    usage: 'say <mensaje>',
    description: 'Repite un mensaje y borra el comando del usuario.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const text = (args || []).join(' ').trim();
        const replyToId = message?.reference?.messageId || null;

        if (!text) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Say',
                        text: 'No puedo enviar un mensaje vacío.',
                    })
                )
            );
        }

        // 1) Borra el mensaje del usuario (si se puede)
        await safeDeleteMessage(message);

        // Mensaje normal (como bot)
        await message.channel.send({
            content: text,
            ...(replyToId ? { reply: { messageReference: replyToId } } : {}),
            allowedMentions: { parse: [], repliedUser: false },
        });
    },
};
