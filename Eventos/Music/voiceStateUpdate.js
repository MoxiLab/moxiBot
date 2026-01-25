const Moxi = require("../../index");
const { MessageFlags } = require("discord.js");
const { buildDisabledMusicSessionContainer } = require("../../Components/V2/musicControlsComponent");
const logger = require("../../Util/logger");

Moxi.on('voiceStateUpdate', async (oldVoice, newVoice) => {
    const player = Moxi.poru.players.get(oldVoice.guild.id);
    if (!player) return;

    // Comprueba si el bot todavía está en un canal
    const botChannel = newVoice.guild.members.me?.voice?.channel;
    if (botChannel && botChannel.id === player.voiceChannel) {
        // Comprueba si hay otros miembros en el canal
        if (botChannel.members.size === 1) {

            logger.warn(`[MUSIC] Bot solo en canal; destruyendo player | guild=${oldVoice.guild.id} channel=${botChannel.id}`);

            if (Moxi.previousMessage) {
                try {
                    const lastSession = await player.get("lastSessionData");
                    if (lastSession) {
                        const disabledContainer = buildDisabledMusicSessionContainer({
                            title: lastSession.title,
                            info: lastSession.info,
                            imageUrl: lastSession.imageUrl,
                            footerText: "_**Moxi Studios**_ - Sesión Finalizada",
                        });
                        await Moxi.previousMessage.edit({
                            components: [disabledContainer],
                            flags: MessageFlags.IsComponentsV2,
                        });
                    }
                } catch (e) {
                    // ignorar
                }
            }

            player.destroy();
        }
    }
});
