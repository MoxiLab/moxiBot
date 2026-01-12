// Controlador para selects del comando canal/channel
module.exports = async function channelSelectMenu(interaction, Moxi, logger) {
    if (!interaction.customId?.startsWith('channel_')) return false;
    // Aquí puedes guardar la selección en la base de datos, cache, o en el mensaje (customId)
    // Por simplicidad, respondemos con un mensaje de confirmación temporal
    await interaction.reply({ content: 'Selección recibida. Pulsa continuar para seguir.', ephemeral: true });
    return true;
};
