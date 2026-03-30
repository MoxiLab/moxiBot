// Utilidad para construir el embed y los componentes del help
const { ContainerBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');
const { EMOJIS } = require('./emojis');
const { Bot } = require('../Config');

/**
 * Construye el help en Components V2.
 * @param {Object} options - Opciones de ayuda (página, categoría, totalPages, etc.)
 * @returns {{ content: string, components: [ContainerBuilder], flags: number }}
 */
function buildHelpEmbed({ page = 0, totalPages = 1, categoria = null, desc = 'Contenido de ayuda', titulo = 'Ayuda' } = {}) {
  // Get lang from categoria if available (hack: pass lang as categoria.lang if needed)
  let lang = 'es-ES';
  if (typeof categoria === 'object' && categoria !== null && categoria.lang) lang = categoria.lang;
  // Use translated footer
  const moxi = require('../i18n');
  const pageFooter = moxi.translate('HELP_PAGE_TEXT', lang).replace('{{current}}', (page + 1)).replace('{{total}}', totalPages);
  const container = new ContainerBuilder()
    .setAccentColor(Bot.AccentColor)
    .addTextDisplayComponents(c => c.setContent(`## ${titulo}`))
    .addSeparatorComponents(s => s.setDivider(true))
    .addTextDisplayComponents(c => c.setContent(desc))
    .addSeparatorComponents(s => s.setDivider(true))
    .addTextDisplayComponents(c => c.setContent(pageFooter));

  const prevButton = new ButtonBuilder()
    .setCustomId('help_prev')
    .setEmoji(EMOJIS.arrowLeft)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(totalPages <= 1 || page <= 0);

  const homeButton = new ButtonBuilder()
    .setCustomId('help_home')
    .setEmoji(EMOJIS.home)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(false);

  const closeButton = new ButtonBuilder()
    .setCustomId('help_close')
    .setEmoji(EMOJIS.cross)
    .setStyle(ButtonStyle.Danger)
    .setDisabled(false);

  const infoButton = new ButtonBuilder()
    .setCustomId('help_info')
    .setEmoji(EMOJIS.question)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(false);

  const nextButton = new ButtonBuilder()
    .setCustomId('help_next')
    .setEmoji(EMOJIS.arrowRight)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(totalPages <= 1 || page >= totalPages - 1);

  container.addActionRowComponents(row => row.addComponents(prevButton, homeButton, closeButton, infoButton, nextButton));
  return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = buildHelpEmbed;
