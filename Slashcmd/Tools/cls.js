const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');

function toolsCategory(lang) {
  lang = lang || 'es-ES';
  return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
}

module.exports = {
  cooldown: 0,
  Category: toolsCategory,
  data: new SlashCommandBuilder()
    .setName('cls')
    .setDescription('Limpia el chat borrando los mensajes recientes (máx 100)')
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad de mensajes a borrar (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async run(Moxi, interaction) {
    const guildId = interaction.guildId || interaction.guild?.id;
    await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    const amount = interaction.options.getInteger('cantidad') || 50;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'Necesitas el permiso de **Gestionar mensajes** para usar este comando.', ephemeral: true });
    }

    // Igual que el prefix: no dejamos reply visible; solo un aviso en el canal que se auto-borra.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      const deletedCount = deleted?.size ?? 0;
      const container = new ContainerBuilder()
        .setAccentColor(0x00bfff)
        .addTextDisplayComponents(c => c.setContent(`🧹 Se han borrado **${deletedCount}** mensajes.`));

      const msg = await interaction.channel.send({
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      setTimeout(() => msg.delete().catch(() => { }), 3000);
      await interaction.deleteReply().catch(() => null);
      return;
    } catch (err) {
      return interaction.editReply({ content: 'No se pudieron borrar los mensajes. ¿Son muy antiguos?' });
    }
  },
};
