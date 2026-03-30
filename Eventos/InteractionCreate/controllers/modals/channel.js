// Controlador para modals del comando canal/channel
module.exports = async function channelModal(interaction, Moxi, logger) {
    if (!interaction.isModalSubmit()) return false;
    if (!interaction.customId?.startsWith('channel_modal_')) return false;

    const action = interaction.customId.replace('channel_modal_', '');
    const name = interaction.fields.getTextInputValue('channel_name');
    const type = interaction.fields.getTextInputValue('channel_type');
    const guild = interaction.guild;

    if (!guild) {
        await interaction.reply({ content: 'No se encontró el servidor.', ephemeral: true });
        return true;
    }

    if (action === 'crear') {
        let typeNum = 0;
        if (type === 'voz') typeNum = 2;
        if (type === 'categoria') typeNum = 4;
        try {
            await guild.channels.create({ name, type: typeNum });
            await interaction.reply({ content: `Canal creado: ${name}`, ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: 'Error al crear el canal: ' + e.message, ephemeral: true });
        }
        return true;
    }
    // Puedes añadir lógica para borrar, renombrar, mover...
    return false;
};
