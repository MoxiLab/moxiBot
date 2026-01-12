// Controlador para botones del comando canal/channel
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
module.exports = async function channelButton(interaction, Moxi, logger) {
    if (!interaction.customId?.startsWith('channel_')) return false;
    if (interaction.customId === 'channel_continue') {
        // Modal para crear canal
        const modal = new ModalBuilder()
            .setCustomId('channel_modal_crear')
            .setTitle('Crear canal');
        const nameInput = new TextInputBuilder()
            .setCustomId('channel_name')
            .setLabel('Nombre del canal')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        const typeInput = new TextInputBuilder()
            .setCustomId('channel_type')
            .setLabel('Tipo (texto, voz, categoria)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(typeInput)
        );
        await interaction.showModal(modal);
        return true;
    }
    if (interaction.customId === 'channel_cancel') {
        await interaction.reply({ content: 'Operación cancelada.', ephemeral: true });
        return true;
    }
    return false;
};
