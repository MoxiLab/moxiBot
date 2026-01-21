const handlers = [
  require('./buttons/moxidex'),
  require('./buttons/pet'),
  require('./buttons/shop'),
  require('./buttons/bugStatus'),
  require('./buttons/modv2'),
  require('./buttons/lavanode'),
  require('./buttons/mongonode'),
  require('./buttons/ping'),
  require('./buttons/helpV2'),
  require('./buttons/helpLegacy'),
  require('./buttons/userPerms'),
  require('./buttons/timer'),
  require('./buttons/channel'),
  require('./buttons/perms'),
  require('./buttons/bag'),
  require('./buttons/buffs'),
  require('./buttons/balance'),
  require('./buttons/fish'),
  require('./buttons/minePlay'),
  require('./buttons/minesweeper'),
  require('./buttons/rps'),
  require('./buttons/zones'),
  require('./buttons/crime'),
  require('./buttons/leave'), // <-- Añadido para leave
  require('./buttons/workList'),
  require('./buttons/workApply'),
  require('./buttons/suggest'),
  require('./buttons/craft'),
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
