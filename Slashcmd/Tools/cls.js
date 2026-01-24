const { PermissionFlagsBits, ContainerBuilder, MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
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
      const limit = Math.min(100, Math.max(1, amount));
      const channel = interaction.channel;

      const me = interaction.guild?.members?.me || await interaction.guild?.members?.fetchMe?.().catch(() => null);
      const botPerms = me ? channel.permissionsFor(me) : null;
      if (!botPerms?.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply({ content: 'No puedo borrar mensajes: me falta **Gestionar mensajes** en este canal.' });
      }
      if (botPerms && !botPerms.has(PermissionFlagsBits.ReadMessageHistory)) {
        return interaction.editReply({ content: 'No puedo borrar mensajes: me falta **Leer el historial de mensajes** en este canal.' });
      }

      const fetched = await channel.messages.fetch({ limit }).catch(() => null);
      const cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);

      const eligible = fetched
        ? fetched.filter((m) => !m.pinned && (m.createdTimestamp || 0) > cutoff)
        : null;

      const deleted = eligible ? await channel.bulkDelete(eligible, true) : await channel.bulkDelete(limit, true);
      const deletedCount = deleted?.size ?? 0;
      const fetchedCount = fetched?.size ?? limit;
      const skippedOldOrPinned = eligible ? Math.max(0, fetchedCount - eligible.size) : 0;

      const container = new ContainerBuilder()
        .setAccentColor(0x00bfff)
        .addTextDisplayComponents(c => c.setContent(`🧹 Se han borrado **${deletedCount}** mensajes.`));

      if (skippedOldOrPinned > 0) {
        container.addTextDisplayComponents(c => c.setContent(`Se omitieron **${skippedOldOrPinned}** por estar fijados o ser de hace más de 14 días.`));
      } else if (deletedCount === 0) {
        container.addTextDisplayComponents(c => c.setContent('No se pudo borrar nada. Si los mensajes son antiguos (+14 días), Discord no permite borrarlos en masa.'));
      }

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
