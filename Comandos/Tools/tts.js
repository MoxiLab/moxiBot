const { MessageFlags, PermissionsBitField } = require('discord.js');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { toolsCategory } = require('../../Util/commandCategories');
const { speakInVoice, buildTtsUrl, splitTtsText, fetchTtsMp3Stream } = require('../../Util/discordVoiceTts');

async function safeDeleteMessage(message) {
    try {
        if (!message?.deletable) return false;
        await message.delete();
        return true;
    } catch {
        return false;
    }
}

function hasVoicePerms(channel, me) {
    try {
        const perms = channel.permissionsFor(me);
        if (!perms) return false;
        return perms.has(PermissionsBitField.Flags.Connect, true)
            && perms.has(PermissionsBitField.Flags.Speak, true);
    } catch {
        return false;
    }
}

module.exports = {
    name: 'tts',
    alias: ['ttsv'],
    Category: toolsCategory,
    usage: 'tts <mensaje> | tts texto <mensaje>',
    description: 'Reproduce TTS en tu canal de voz (sin Lavalink). Usa "texto" para enviar el MP3 al canal.',
    cooldown: 3,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const tokens = Array.isArray(args) ? args : [];
        const mode = (tokens[0] || '').toString().trim().toLowerCase();

        const isTextMode = (mode === 'texto' || mode === 'text' || mode === 'mp3' || mode === 'archivo');
        const text = (isTextMode ? tokens.slice(1) : tokens).join(' ').trim();

        if (!text) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'TTS',
                        text: `Uso: ${this.usage}`,
                    })
                )
            );
        }

        const vc = message.member?.voice?.channel;
        const shouldUseVoice = !isTextMode && !!vc;

        if (shouldUseVoice) {
            if (!hasVoicePerms(vc, message.guild?.members?.me)) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'TTS (Voz)',
                            text: 'No tengo permisos para conectar y hablar en ese canal de voz.',
                        })
                    )
                );
            }

            await safeDeleteMessage(message);

            try {
                const res = await speakInVoice({
                    guild: message.guild,
                    member: message.member,
                    text,
                });
                const queued = res && typeof res.queued === 'number' ? res.queued : 1;
                const reply = await message.channel.send({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.check,
                            title: 'TTS (Voz)',
                            text: `En cola: ${queued} parte(s).`,
                        })
                    ),
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                }).catch(() => null);

                if (reply) {
                    setTimeout(() => reply.delete().catch(() => null), 7000);
                }
                return;
            } catch (err) {
                return message.channel.send(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'TTS (Voz)',
                            text: (err && err.message) ? err.message : 'No pude reproducir el TTS en voz.',
                        })
                    )
                );
            }
        }

        // Modo texto: generar audio externo y mandarlo como archivo (sin TTS de Discord)
        await safeDeleteMessage(message);

        try {
            const chunks = splitTtsText(text);
            const first = chunks[0] || text;
            const url = buildTtsUrl({ text: first });
            const stream = await fetchTtsMp3Stream(url);

            await message.channel.send({
                content: chunks.length > 1
                    ? `${text.slice(0, 2000)}\n\n(Nota: el audio se generó solo con la primera parte del texto.)`
                    : text,
                files: [{ attachment: stream, name: 'tts.mp3' }],
                allowedMentions: { parse: [], repliedUser: false },
            });
        } catch {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'TTS',
                        text: 'No pude generar/enviar el audio TTS en este canal.',
                    })
                )
            );
        }
    },
};
