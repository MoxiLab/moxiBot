const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { speakInVoice, buildTtsUrl, splitTtsText, fetchTtsMp3Stream } = require('../../Util/discordVoiceTts');

function toolsCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
}

module.exports = {
    cooldown: 5,
    Category: toolsCategory,
    data: new SlashCommandBuilder()
        .setName('tts')
        .setDescription('Envía un mensaje con TTS (texto a voz)')
        .addStringOption((opt) =>
            opt
                .setName('mensaje')
                .setDescription('Texto a enviar con TTS')
                .setRequired(true)
                .setMaxLength(250)
        )
        .addBooleanOption((opt) =>
            opt
                .setName('silenciar_menciones')
                .setDescription('Evita pings (recomendado)')
                .setRequired(false)
        )
        .addBooleanOption((opt) =>
            opt
                .setName('en_voz')
                .setDescription('Reproduce el TTS en tu canal de voz (sin Lavalink)')
                .setRequired(false)
        )
        .addStringOption((opt) =>
            opt
                .setName('voz')
                .setDescription('Nombre de voz (solo si TTS_PROVIDER=streamelements), ej: Brian')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const text = String(interaction.options.getString('mensaje', true)).trim();
        const muteMentions = interaction.options.getBoolean('silenciar_menciones') ?? true;
        const explicitInVoice = interaction.options.getBoolean('en_voz');
        const memberVoiceChannel = interaction.member?.voice?.channel;
        const inVoice = (explicitInVoice === null || explicitInVoice === undefined)
            ? !!memberVoiceChannel
            : !!explicitInVoice;
        const voiceName = interaction.options.getString('voz') || '';

        if (!text) {
            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'TTS',
                        text: 'No puedo enviar un mensaje vacío.',
                    })
                ),
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (inVoice) {
            try {
                const res = await speakInVoice({
                    guild: interaction.guild,
                    member: interaction.member,
                    text,
                    voice: voiceName,
                });

                const queued = res && typeof res.queued === 'number' ? res.queued : 1;
                return interaction.editReply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.check,
                            title: 'TTS (Voz)',
                            text: `En cola: ${queued} parte(s).`,
                        })
                    ),
                });
            } catch (err) {
                return interaction.editReply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'TTS (Voz)',
                            text: (err && err.message) ? err.message : 'No pude reproducir el TTS en voz.',
                        })
                    ),
                });
            }
        }

        // Modo texto: generar audio externo y mandarlo como archivo (sin TTS de Discord)
        try {
            const chunks = splitTtsText(text);
            const first = chunks[0] || text;
            const url = buildTtsUrl({ text: first, voice: voiceName });
            const stream = await fetchTtsMp3Stream(url);

            await interaction.channel.send({
                content: chunks.length > 1
                    ? `${text.slice(0, 2000)}\n\n(Nota: el audio se generó solo con la primera parte del texto.)`
                    : text,
                files: [{ attachment: stream, name: 'tts.mp3' }],
                allowedMentions: muteMentions ? { parse: [] } : undefined,
            });
        } catch {
            return interaction.editReply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'TTS',
                        text: 'No pude generar/enviar el audio TTS en este canal.',
                    })
                ),
            });
        }

        await interaction.deleteReply().catch(() => null);
        return;
    },
};

