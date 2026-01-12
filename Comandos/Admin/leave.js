
const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ownerPermissions } = require('../../Util/ownerPermissions');

module.exports = {
  name: 'leave',
  description: 'Hace que el bot abandone el servidor actual',
  category: 'Admin',
  async execute(client, message, args) {
    // Solo owners (bot, guild o app) pueden usarlo
    const fakeInteraction = {
      user: message.author,
      memberPermissions: message.member?.permissions,
      guild: message.guild
    };
    const isOwner = await ownerPermissions(fakeInteraction, client);
    if (!isOwner) {
      return message.reply('Solo los owners pueden usar este comando.');
    }

    const container = new ContainerBuilder()
      .setAccentColor(0xff5555)
      .addTextDisplayComponents(c => c.setContent(`## ¿Seguro que quieres que el bot abandone este servidor?`))
      .addSeparatorComponents(s => s.setDivider(true))
      .addActionRowComponents(row =>
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_leave_guild')
            .setLabel('Salir del servidor')
            .setStyle(ButtonStyle.Danger)
        )
      )
      .addSeparatorComponents(s => s.setDivider(true))
      .addTextDisplayComponents(c => c.setContent(`ID: ${message.guild.id}`));

    await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
