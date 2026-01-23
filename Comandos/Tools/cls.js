const { ContainerBuilder, MessageFlags } = require('discord.js');

module.exports = {
  name: 'cls',
  alias: ['clear', 'limpiar'],
  description: 'Limpia el chat borrando los mensajes recientes (máx 100)',
  category: 'Tools',
  async execute(client, message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply('Necesitas el permiso de **Gestionar mensajes** para usar este comando.');
    }
    const amount = parseInt(args[0], 10) || 50;
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('Debes especificar un número entre 1 y 100.');
    }
    try {
      const deleted = await message.channel.bulkDelete(amount, true);
      const deletedCount = deleted?.size ?? 0;
      // Componentes V2 para confirmación visual
      const container = new ContainerBuilder()
        .setAccentColor(0x00bfff)
        .addTextDisplayComponents(c => c.setContent(`🧹 Se han borrado **${deletedCount}** mensajes.`));
      const msg = await message.channel.send({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
      setTimeout(() => msg.delete().catch(() => { }), 3000);
    } catch (err) {
      return;
    }
  },
};
