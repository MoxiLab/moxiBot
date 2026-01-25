const { ContainerBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ButtonBuilder } = require('../../../../Util/compatButtonBuilder');
const fs = require('fs');
const path = require('path');
const moxi = require('../../../../i18n');
const { Bot } = require('../../../../Config');
const { EMOJIS } = require('../../../../Util/emojis');

module.exports = async function(interaction, Moxi, logger) {
  if (interaction.customId !== 'refresh_rules') return false;
  const lang = await moxi.guildLang(interaction.guild?.id, 'es-ES');
  const rulesPath = path.join(__dirname, '../../../../Languages', lang, 'rules', 'rules.json');
  let rules = null;
  if (fs.existsSync(rulesPath)) {
    rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  } else {
    const fallbackPath = path.join(__dirname, '../../../../Languages/es-ES/rules/rules.json');
    if (fs.existsSync(fallbackPath)) {
      rules = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    }
  }
  if (!rules) {
    await interaction.reply({ content: 'No se encontraron las reglas del servidor.', ephemeral: true });
    return true;
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
    c.setContent(`${EMOJIS.copyright} ${interaction.client.user?.username || 'Moxi Studio'} • ${new Date().getFullYear()}`)
  );
  await interaction.update({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
  return true;
};
