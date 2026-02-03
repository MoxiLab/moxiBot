const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');

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
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const text = String(interaction.options.getString('mensaje', true)).trim();
        const muteMentions = interaction.options.getBoolean('silenciar_menciones') ?? true;

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

        // Confirmación ephemeral y borrado (como /say)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await interaction.channel.send({
                content: text,
                tts: true,
                allowedMentions: muteMentions ? { parse: [] } : undefined,
            });
        } catch {
            return interaction.editReply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'TTS',
                        text: 'No pude enviar el mensaje TTS en este canal.',
                    })
                ),
            });
        }

        await interaction.deleteReply().catch(() => null);
        return;
    },
};
