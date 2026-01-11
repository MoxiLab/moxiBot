const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags, ContainerBuilder, ButtonBuilder, ButtonStyle, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const moxi = require('../../../../i18n');
const { Bot } = require('../../../../Config');
const { EMOJIS } = require('../../../../Util/emojis');
const timerStorage = require('../../../../Util/timerStorage');

module.exports = async function timerButtonHandler(interaction, Moxi, logger) {
    if (!interaction.customId || interaction.customId !== 'nuevo_timer') return false;

    const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
    const guildId = interaction.guildId || interaction.guild?.id;
    const channelId = interaction.channelId || interaction.channel?.id;
    const userId = interaction.user?.id || interaction.member?.user?.id;

    // Si ya hay un temporizador activo en este canal, avisar
    const current = timerStorage.getTimer(guildId, channelId);
    if (current) {
        await interaction.reply({
            content: moxi.translate('Ya hay un temporizador activo en este canal.', lang),
            ephemeral: true
        });
        return true;
    }

    // Mostrar modal para pedir minutos
    const modal = new ModalBuilder()
        .setCustomId('timer_modal')
        .setTitle('Nuevo temporizador')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('minutos')
                    .setLabel('¿Cuántos minutos? (1-1440)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );
    await interaction.showModal(modal);
    return true;
};
