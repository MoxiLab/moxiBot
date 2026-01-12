const { ContainerBuilder, MessageFlags } = require('discord.js');

module.exports = {
  name: 'cls',
  aliases: ['clear', 'limpiar'],
  description: 'Limpia el chat borrando los mensajes recientes (máx 100)',
  category: 'Tools',
  async execute(client, message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      await message.channel.send('Necesitas el permiso de **Gestionar mensajes** para usar este comando.');
      return;
    }
    const amount = parseInt(args[0], 10) || 50;
    if (isNaN(amount) || amount < 1 || amount > 100) {
      await message.channel.send('Debes especificar un número entre 1 y 100.');
      return;
    }
    try {
      // Bandera global para evitar logs individuales
      global.__moxiBulkDelete = true;
      await message.delete().catch(() => {});
      await message.channel.bulkDelete(amount, true);
      // Componentes V2 para confirmación visual
      const container = new ContainerBuilder()
        .setAccentColor(0x00bfff)
        .addTextDisplayComponents(c => c.setContent(`🧹 Se han borrado **${amount}** mensajes.`));
      const msg = await message.channel.send({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
      setTimeout(() => msg.delete().catch(() => {}), 3000);

      // Enviar log masivo manualmente
      const audit = require('../../Util/audit');
      const { messageBulkDeleteEmbed } = require('../../Util/auditAdminEmbeds');
      if (message.guild) {
        const { lang, channelId, enabled } = await audit.resolveAuditConfig(message.guild.id, 'es-ES');
        if (enabled && channelId) {
          const ch = message.guild.channels.cache.get(channelId);
          if (ch && typeof ch.send === 'function') {
            const now = new Date();
            const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
            const v2 = messageBulkDeleteEmbed({ channelId: message.channel.id, count: amount, timeStr });
            await ch.send(v2).catch(() => null);
          }
        }
      }
      // Espera breve y limpia la bandera
      setTimeout(() => { global.__moxiBulkDelete = false; }, 1000);
    } catch (err) { 
      return;
    }
  },
};
