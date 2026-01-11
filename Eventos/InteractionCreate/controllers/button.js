const handlers = [
  require('./buttons/bugStatus'),
  require('./buttons/modv2'),
  require('./buttons/lavanode'),
  require('./buttons/mongonode'),
  require('./buttons/ping'),
  require('./buttons/helpV2'),
  require('./buttons/helpLegacy'),
  require('./buttons/userPerms'),
  require('./buttons/timer'),
];

module.exports = async function buttonController(interaction, Moxi, logger) {
  if (!interaction?.customId) return;

  for (const handler of handlers) {
    try {
      if (await handler(interaction, Moxi, logger)) return;
    } catch (error) {
      logger?.error?.(error);
      try {
        const moxi = require('../../../i18n');
        const { buildNoticeContainer } = require('../../../Util/v2Notice');
        const { EMOJIS } = require('../../../Util/emojis');
        const { MessageFlags } = require('discord.js');
        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const payload = {
          content: '',
          components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('ERROR', lang) })],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      } catch { }
      return;
    }
  }
};
