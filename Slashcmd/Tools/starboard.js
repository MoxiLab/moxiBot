const { SlashCommandBuilder } = require('discord.js');
const { readFileSync } = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Configura o consulta el sistema starboard')
    .addSubcommand(subcommand =>
      subcommand
        .setName('help')
        .setDescription('Muestra la explicación de cómo funciona el starboard')
    ),
  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'help') {
      try {
        const filePath = path.join(__dirname, '../../EXPLICACION_STARBOARD.md');
        const contenido = readFileSync(filePath, 'utf8');
        // Discord limita los mensajes a 2000 caracteres, así que dividimos si es necesario
        const partes = contenido.match(/([\s\S]{1,1900})(\n|$)/g);
        for (const parte of partes) {
          await interaction.reply({ content: parte, ephemeral: true });
        }
      } catch (err) {
        await interaction.reply({ content: 'No se pudo cargar la explicación de starboard.', ephemeral: true });
      }
    }
  },
};
