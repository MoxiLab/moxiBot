const { PermissionFlagsBits, ContainerBuilder, MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

async function purgeRecentMessages(channel, amount, { keepPinned = true } = {}) {
  if (!channel?.messages?.fetch) {
    throw new Error('Este canal no soporta fetch de mensajes.');
  }

  const fetchLimit = Math.min(100, Math.max(1, Number(amount) || 0) + 10);
  const fetched = await channel.messages.fetch({ limit: fetchLimit });

  const candidates = [];
  for(let i = 0, msg = fetched.at(i); i < amount; i++, msg = fetched.at(i)) {
    if (!msg) break;
    if(!keepPinned || !msg.pinned) candidates.push(msg);
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

      const result = await purgeRecentMessages(channel, limit, { keepPinned: true });
      const deletedCount = result.deletedCount;
      const skippedOldOrPinned = Math.max(0, result.attempted - result.deletedCount);

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
