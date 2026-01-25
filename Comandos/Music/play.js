// Comando de prefijo: play
// Reutiliza la lógica del subcomando "play" de musica.js (slash)

const musica = require('../../Slashcmd/Musica/musica.js');

const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

function makeResponder(message) {
    return {
        reply: async (payload) => message.reply(payload),
        editReply: async (payload) => message.reply(payload),
        deferReply: async () => { },
    };
}

module.exports = {
    name: "play",
    alias: ["play", "reproducir", "tocar"],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_MUSICA', lang);
    },
    usage: 'play <canción> <plataforma>',
    description: function (lang) { return moxi.translate('commands:CMD_PLAY_DESC', lang || 'es-ES'); },
    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        const requesterId = message.author?.id;
        debugHelper.log('play', 'prefix execute start', { guildId, requesterId, args: args.slice(0, 2) });
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        // Antes de pedir canción: asegurar que el usuario está en un canal de voz
        const memberVoiceId = message.member?.voice?.channelId;
        const botVoiceId = message.guild?.members?.me?.voice?.channelId;
        if (!memberVoiceId) {
            debugHelper.warn('play', 'member not in voice', { guildId, requesterId });
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('MUSIC_JOIN_VOICE', lang) })
                )
            );
        }
        if (botVoiceId && botVoiceId !== memberVoiceId) {
            debugHelper.warn('play', 'bot wrong voice', { guildId, requesterId });
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('MUSIC_SAME_VOICE_CHANNEL', lang) })
                )
            );
        }

        if (!args.length) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('MUSIC_TRACK_REQUIRED', lang) })
                )
            );
        }

        // Permite: .play <texto con espacios> [spotify|youtube]
        const last = String(args[args.length - 1] || '').toLowerCase();
        const hasPlatform = last === 'spotify' || last === 'youtube';
        const platform = hasPlatform ? last : 'spotify';
        const track = (hasPlatform ? args.slice(0, -1) : args).join(' ').trim();
        const responder = makeResponder(message);
        // Simula la estructura de interaction para reutilizar la lógica
        const fakeInteraction = {
            guild: message.guild,
            guildId: message.guild.id,
            member: message.member,
            channel: message.channel,
            user: message.author,
            options: {
                getSubcommand: () => 'play',
                getString: (name) => name === 'track' ? track : (name === 'platform' ? platform : undefined)
            },
            deferReply: responder.deferReply,
            editReply: responder.editReply,
            reply: responder.reply,
            lang,
        };
        await musica.run(Moxi, fakeInteraction);
    }
};
