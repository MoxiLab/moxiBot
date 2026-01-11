
const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Traducción de título y botón (fuera de la función)
const TITLES = {
  'es-ES': 'Reglas de Moxi Studio',
  'en-US': 'Moxi Studio Rules',
  'fr-FR': 'Règles de Moxi Studio',
  'de-DE': 'Moxi Studio Regeln',
  'it-IT': 'Regole di Moxi Studio',
  'pt-BR': 'Regras do Moxi Studio',
  'ja-JP': 'Moxi Studioのルール',
};
const BTN_LABELS = {
  'es-ES': 'Refrescar',
  'en-US': 'Refresh',
  'fr-FR': 'Rafraîchir',
  'de-DE': 'Aktualisieren',
  'it-IT': 'Aggiorna',
  'pt-BR': 'Atualizar',
  'ja-JP': '更新',
};

module.exports = {
  name: 'reglas',
  alias: ['rules'],
  description: 'Muestra las reglas del servidor',
  Category: function (lang) {
    lang = lang || 'es-ES';
    const moxi = require('../../i18n');
    return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
  },
  async execute(client, message, args) {
    const moxi = require('../../i18n');
    const { Bot } = require('../../Config');
    const { EMOJIS } = require('../../Util/emojis');
    const logger = require('../../Util/logger');
    logger.debug?.('[rules] Ejecutando comando de reglas', { guild: message.guild?.id, user: message.author?.id });
    try {
      const lang = await moxi.guildLang(message.guild?.id, 'es-ES');
      let rules = null;
      let usedLang = lang;
      const rulesPath = path.join(__dirname, '../../Languages', lang, 'rules', 'rules.json');
      logger.debug?.('[rules] Buscando reglas en', rulesPath);
      if (fs.existsSync(rulesPath)) {
        rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
      } else {
        logger.error?.('[rules] No se encontraron reglas para mostrar');
        return message.channel.send('No se encontraron las reglas del servidor.');
      }

      // Traducción de título (ahora fuera de la función)
      const title = TITLES[usedLang] || TITLES['en-US'];

      // Detectar claves correctas
      const getTitle = r => r.title || r.titulo || '';
      const getDesc = r => r.description || r.descripcion || '';

      const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.book || '📖'} ${title}`))
        .addSeparatorComponents(s => s.setDivider(true));

      for (const regla of rules) {
        container.addTextDisplayComponents(c =>
          c.setContent(`**${regla.id}. ${getTitle(regla)}**\n${getDesc(regla)}`)
        );
        container.addSeparatorComponents(s => s.setDivider(false));
      }

      // Botón para los reglamentos de Discord
      const discordTermsUrl = 'https://discord.com/terms';
      const discordGuidelinesUrl = 'https://discord.com/guidelines';
      container.addActionRowComponents(row =>
        row.addComponents(
          new ButtonBuilder()
            .setLabel('Términos de Discord')
            .setStyle(ButtonStyle.Link)
            .setURL(discordTermsUrl),
          new ButtonBuilder()
            .setLabel('Normas de Discord')
            .setStyle(ButtonStyle.Link)
            .setURL(discordGuidelinesUrl)
        )
      );
      container.addSeparatorComponents(s => s.setDivider(true));
      container.addTextDisplayComponents(c =>
        c.setContent(`${EMOJIS.copyright} ${client.user?.username || 'Moxi Studio'} • ${new Date().getFullYear()}`)
      );

      const sent = await message.channel.send({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
      // Guardar en MongoDB el canal y mensaje de reglas
      try {
        const GuildMessage = require('../../Models/GuildMessage');
        await GuildMessage.findOneAndUpdate(
          { guildId: message.guild.id, type: 'rules' },
          {
            guildId: message.guild.id,
            type: 'rules',
            channelId: message.channel.id,
            messageId: sent.id,
            lastLanguage: lang,
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        logger.error?.('[rules] No se pudo guardar el mensaje de reglas en MongoDB:', err);
      }
      // Borrar el mensaje del usuario que ejecutó el comando
      try {
        await message.delete().catch(() => { });
      } catch { }
      return sent;
    } catch (err) {
      logger.error?.('[rules] Error ejecutando comando:', err);
      return message.reply('Ocurrió un error mostrando las reglas.');
    }
  },
};