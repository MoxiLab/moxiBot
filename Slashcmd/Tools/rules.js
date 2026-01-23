const { ContainerBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const fs = require('fs');
const path = require('path');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Muestra las reglas del servidor en tu idioma'),

  async execute(client, interaction, args) {
    const lang = await moxi.guildLang(interaction.guild?.id, 'es-ES');
    const rulesPath = path.join(__dirname, '../../Languages', lang, 'rules', 'rules.json');
    let rules = null;
    if (fs.existsSync(rulesPath)) {
      rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    } else {
      // fallback a español
      const fallbackPath = path.join(__dirname, '../../Languages/es-ES/rules/rules.json');
      if (fs.existsSync(fallbackPath)) {
        rules = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      }
    }
    if (!rules) {
      return interaction.reply({ content: 'No se encontraron las reglas del servidor.', ephemeral: true });
    }

    const container = new ContainerBuilder()
      .setAccentColor(Bot.AccentColor)
      .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.book || '📖'} Reglas de Moxi Studio`))
      .addSeparatorComponents(s => s.setDivider(true));

    for (const regla of rules) {
      container.addTextDisplayComponents(c =>
        c.setContent(`**${regla.id}. ${regla.titulo}**\n${regla.descripcion}`)
      );
      container.addSeparatorComponents(s => s.setDivider(false));
    }

    container.addActionRowComponents(row =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('refresh_rules')
          .setLabel('Refrescar')
          .setStyle(ButtonStyle.Primary)
      )
    );
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c =>
      c.setContent(`${EMOJIS.copyright} ${client.user?.username || 'Moxi Studio'} • ${new Date().getFullYear()}`)
    );

    const sentMessage = await interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, fetchReply: true });

    // Guardar en MongoDB el canal y mensaje de reglas
    try {
      const GuildMessage = require('../../Models/GuildMessageSchema');
      await GuildMessage.findOneAndUpdate(
        { guildId: interaction.guild.id, type: 'rules' },
        {
          guildId: interaction.guild.id,
          type: 'rules',
          channelId: interaction.channel.id,
          messageId: sentMessage.id,
          lastLanguage: lang,
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('No se pudo guardar el mensaje de reglas en MongoDB:', err);
    }
  },
};
