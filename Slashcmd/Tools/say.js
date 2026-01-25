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
    cooldown: 0,
    Category: toolsCategory,
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Envía un mensaje como el bot')
        .addStringOption((opt) =>
            opt
                .setName('mensaje')
                .setDescription('Texto a enviar')
                .setRequired(true)
                .setMaxLength(2000)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const text = String(interaction.options.getString('mensaje', true)).trim();
        if (!text) {
            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Say',
                        text: 'No puedo enviar un mensaje vacío.',
                    })
                ),
                flags: MessageFlags.Ephemeral,
            });
        }

        // No dejamos confirmación: defer ephemeral y borramos el reply al final.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Enviar en el canal donde se ejecuta el slash.
        try {
            await interaction.channel.send({
                content: text,
                allowedMentions: { parse: [] },
            });
        } catch {
            return interaction.editReply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Say',
                        text: 'No pude enviar el mensaje en este canal.',
                    })
                ),
            });
        }

        await interaction.deleteReply().catch(() => null);
        return;
    },
};
