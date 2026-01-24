const { ContainerBuilder, MessageFlags } = require('discord.js');

module.exports = {
  name: 'cls',
  alias: ['clear', 'limpiar'],
  description: 'Limpia el chat borrando los mensajes recientes (máx 100)',
  category: 'Tools',
  async execute(client, message, args) {
    if (!message.guild) {
      return message.reply('Este comando solo funciona dentro de un servidor.');
    }

    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply('Necesitas el permiso de **Gestionar mensajes** para usar este comando.');
    }
    const amount = parseInt(args[0], 10) || 50;
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('Debes especificar un número entre 1 y 100.');
    }
    try {
      const me = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
      const botPerms = me ? message.channel.permissionsFor(me) : null;
      if (!botPerms?.has('ManageMessages')) {
        return message.reply('No puedo borrar mensajes: me falta el permiso **Gestionar mensajes** en este canal.');
      }

      const limit = Math.min(100, Math.max(1, amount));
      const fetched = await message.channel.messages.fetch({ limit }).catch(() => null);
      if (!fetched) {
        // Si el bot no tiene ReadMessageHistory, el fetch puede fallar; bulkDelete por número también depende de fetch interno.
        if (botPerms && !botPerms.has('ReadMessageHistory')) {
          return message.reply('No puedo borrar: me falta el permiso **Leer el historial de mensajes** en este canal.');
        }
      }
      const cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);

      const eligible = fetched
        ? fetched.filter((m) => !m.pinned && (m.createdTimestamp || 0) > cutoff)
        : null;

      // bulkDelete no puede borrar mensajes de +14 días; por eso puede devolver 0 aunque se pida X.
      const deleted = eligible ? await message.channel.bulkDelete(eligible, true) : await message.channel.bulkDelete(limit, true);
      const deletedCount = deleted?.size ?? 0;
      const fetchedCount = fetched?.size ?? limit;
      const skippedOldOrPinned = eligible ? Math.max(0, fetchedCount - eligible.size) : 0;

      // Componentes V2 para confirmación visual
      const container = new ContainerBuilder()
        .setAccentColor(0x00bfff)
        .addTextDisplayComponents(c => c.setContent(`🧹 Se han borrado **${deletedCount}** mensajes.`));

      if (skippedOldOrPinned > 0) {
        container.addTextDisplayComponents(c => c.setContent(`Se omitieron **${skippedOldOrPinned}** por estar fijados o ser de hace más de 14 días.`));
      } else if (deletedCount === 0) {
        container.addTextDisplayComponents(c => c.setContent('No se pudo borrar nada. Si los mensajes son antiguos (+14 días), Discord no permite borrarlos en masa.'));
      }
      const msg = await message.channel.send({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
      setTimeout(() => msg.delete().catch(() => { }), 3000);
    } catch (err) {
      return;
    }
  },
};
