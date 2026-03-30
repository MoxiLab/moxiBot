// Botón: Confirmar salir del servidor
const { ownerPermissions } = require('../../../../Util/ownerPermissions');

const { MessageFlags } = require('discord.js');
module.exports = async (interaction, Moxi) => {
    if (!interaction.isButton() || interaction.customId !== 'confirm_leave_guild') return;
    const isOwner = await ownerPermissions(interaction, Moxi);
    if (!isOwner) {
        return interaction.reply({ content: 'Solo los owners pueden usar este botón.', flags: MessageFlags.Ephemeral });
    }
    await interaction.reply({ content: '👋 Saliendo del servidor...', flags: MessageFlags.Ephemeral });
    await interaction.guild.leave();
};
