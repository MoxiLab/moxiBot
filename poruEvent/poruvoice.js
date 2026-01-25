module.exports = async (Moxi, oldVoice, newVoice) => {

  const logger = require("../Util/logger");

  const player = Moxi.poru.players.get(oldVoice.guild.id);
  if (!player) return;

  // Este evento se dispara por CUALQUIER usuario.
  // Solo nos interesa cuando el propio bot se desconecta/mueve.
  const botId = Moxi.user?.id;
  const memberId = newVoice?.member?.id ?? oldVoice?.member?.id;
  if (!botId || memberId !== botId) return;

  // Destruir solo cuando el bot abandona el canal donde estaba el player.
  const oldChannelId = oldVoice?.channelId;
  const newChannelId = newVoice?.channelId;
  if (oldChannelId && !newChannelId) {
    try {
      logger.warn(`[PORU] Bot left voice channel; destroying player | guild=${oldVoice.guild.id} channel=${oldChannelId}`);
    } catch {
      // noop
    }
    player.destroy();
  }

};