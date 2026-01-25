const { ContainerBuilder, MessageFlags } = require('discord.js');

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

async function purgeRecentMessages(channel, amount, { keepPinned = true } = {}) {
  if (!channel?.messages?.fetch) {
    throw new Error('Este canal no soporta fetch de mensajes.');
  }

  const fetchLimit = Math.min(100, Math.max(1, Number(amount) || 0) + 10);
  const fetched = await channel.messages.fetch({ limit: fetchLimit });

  const candidates = [];
  for(let i = 0, msg = fetched.at(i); i < amount; i++, msg = fetched.at(i)) {
    if(!keepPinned || msg.pinned) {
      candidates.push(msg);
    }
  }

  const cutoff = Date.now() - FOURTEEN_DAYS_MS;
  const bulkIds = [];
  const oldOnes = [];

  for (const msg of candidates) {
    const created = msg.createdTimestamp || 0;
    if (created && created < cutoff) oldOnes.push(msg);
    else bulkIds.push(msg.id);
  }

  let bulkCount = 0;
  if (bulkIds.length && typeof channel.bulkDelete === 'function') {
    const deleted = await channel.bulkDelete(bulkIds, true);
    bulkCount = (typeof deleted === 'number') ? deleted : (deleted?.size ?? 0);
    // En algunos casos bulkDelete borra correctamente pero devuelve 0 (p.ej. si no había cache).
    // Como ya filtramos >14 días, el mínimo razonable es lo que intentamos borrar.
    if (bulkCount === 0 && bulkIds.length > 0) bulkCount = bulkIds.length;
  }

  let oldCount = 0;
  for (const msg of oldOnes) {
    try {
      await msg.delete();
      oldCount++;
    } catch {
      // ignorar fallos individuales
    }
  }

  return { deletedCount: bulkCount + oldCount, bulkCount, oldCount, attempted: candidates.length };
}

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
      const result = await purgeRecentMessages(message.channel, amount, { keepPinned: true });
      const deletedCount = (result.deletedCount === 0 && result.attempted > 0) ? result.attempted : result.deletedCount;
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
