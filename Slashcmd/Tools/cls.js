const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cls')
    .setDescription('Limpia el chat borrando los mensajes recientes (máx 100)')
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad de mensajes a borrar (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async run(Moxi, interaction) {
    const amount = interaction.options.getInteger('cantidad') || 50;
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'Necesitas el permiso de **Gestionar mensajes** para usar este comando.', ephemeral: true });
    }
    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      const deletedCount = deleted?.size ?? 0;
      const container = new ContainerBuilder()
        .setAccentColor(0x00bfff)
        .addTextDisplayComponents(c => c.setContent(`🧹 Se han borrado **${deletedCount}** mensajes.`));
      await interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
      setTimeout(async () => {
        try { await interaction.deleteReply(); } catch { }
      }, 3000);
    } catch (err) {
      return interaction.reply({ content: 'No se pudieron borrar los mensajes. ¿Son muy antiguos?', ephemeral: true });
    }
  },
};
