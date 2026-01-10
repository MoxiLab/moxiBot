module.exports = async (Moxi, oldVoice, newVoice) => {

  const player = Moxi.poru.players.get(oldVoice.guild.id);
  if (!player) return;

  if (!newVoice.guild.members.me.voice.channel) {
    player.destroy();
  }

};