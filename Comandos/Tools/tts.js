const { PermissionsBitField } = require('discord.js');
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

function parseTtsArgs(args) {
    const raw = Array.isArray(args) ? [...args] : [];

    // Por defecto: silenciar menciones.
    let allowMentions = false;

    while (raw.length) {
        const a = String(raw[0] || '').trim();
        const lower = a.toLowerCase();

        if (lower === '-m' || lower === '--mentions' || lower === '--menciones') {
            allowMentions = true;
            raw.shift();
            continue;
        }

        if (lower === '--no-mentions' || lower === '--sin-menciones') {
            allowMentions = false;
            raw.shift();
            continue;
        }

        break;
    }

    const text = raw.join(' ').trim();
    return { text, allowMentions };
}

module.exports = {
    name: 'tts',
    alias: ['ttsay', 'decirtts'],
    Category: toolsCategory,
    usage: 'tts [--menciones] <mensaje>',
    description: 'Envía un mensaje TTS (texto a voz) en el canal de texto y borra el comando.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const { text, allowMentions } = parseTtsArgs(args);
        const replyToId = message?.reference?.messageId || null;

        if (!text) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'TTS',
                        text: 'No puedo enviar un mensaje vacío.',
                    })
                )
            );
        }

        if (text.length > 2000) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'TTS',
                        text: 'El mensaje es demasiado largo (máx. 2000 caracteres).',
                    })
                )
            );
        }

        const channel = message.channel;
        if (!channel?.isTextBased?.()) return;

        // Pre-chequeo de permisos si estamos en guild.
        if (channel?.guild) {
            const me = channel.guild.members?.me;
            if (me) {
                const perms = channel.permissionsFor(me);
                if (!perms?.has(PermissionsBitField.Flags.SendMessages)) {
                    return;
                }
                if (!perms?.has(PermissionsBitField.Flags.SendTTSMessages)) {
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: 'TTS',
                                text: 'No tengo permisos para enviar mensajes TTS en este canal (Send TTS Messages).',
                            })
                        )
                    );
                }
            }
        }

        // 1) Borra el mensaje del usuario (si se puede)
        await safeDeleteMessage(message);

        // 2) Envía TTS
        await channel.send({
            content: text,
            tts: true,
            ...(replyToId ? { reply: { messageReference: replyToId } } : {}),
            allowedMentions: allowMentions ? { repliedUser: false } : { parse: [], repliedUser: false },
        });
    },
};
