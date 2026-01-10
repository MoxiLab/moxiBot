const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Componente V2 reutilizable para mensajes de autonuke y otros
// Devuelve un ActionRowBuilder con un botón de "Refrescar" estilo V2
module.exports = function buildV2Row() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('refresh_autonuke')
            .setLabel('Refrescar')
            .setStyle(ButtonStyle.Primary)
    );
};
