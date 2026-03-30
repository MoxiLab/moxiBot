const Moxi = require("../../index");
const { MessageFlags } = require("discord.js");
const { buildDisabledMusicSessionContainer } = require("../../Components/V2/musicControlsComponent");
const logger = require("../../Util/logger");

const SOLO_DESTROY_GRACE_MS = Number(process.env.MUSIC_SOLO_DESTROY_GRACE_MS || 15000);

Moxi.on('voiceStateUpdate', async (oldVoice, newVoice) => {
    const player = Moxi.poru.players.get(oldVoice.guild.id);
    if (!player) return;

    // Comprueba si el bot todavía está en un canal
    const botChannel = newVoice.guild.members.me?.voice?.channel;
    if (botChannel && botChannel.id === player.voiceChannel) {
        // No uses el tamaño bruto: en algunos setups la cache puede no incluir a todos.
        const humansNow = botChannel.members.filter((m) => !m.user?.bot).size;
        if (humansNow === 0) {
            logger.warn(`[MUSIC] Bot appears alone; waiting grace before destroy | guild=${oldVoice.guild.id} channel=${botChannel.id} graceMs=${SOLO_DESTROY_GRACE_MS}`);

            setTimeout(async () => {
                const livePlayer = Moxi.poru.players.get(oldVoice.guild.id);
                if (!livePlayer) return;

                const liveChannel = newVoice.guild.members.me?.voice?.channel;
                if (!liveChannel || liveChannel.id !== livePlayer.voiceChannel) return;

                const humansLater = liveChannel.members.filter((m) => !m.user?.bot).size;
                if (humansLater > 0) {
                    logger.info(`[MUSIC] Human member rejoined; skipping destroy | guild=${oldVoice.guild.id} channel=${liveChannel.id}`);
                    return;
                }

                logger.warn(`[MUSIC] Bot solo en canal tras gracia; destruyendo player | guild=${oldVoice.guild.id} channel=${liveChannel.id}`);

                if (Moxi.previousMessage) {
                    try {
                        const lastSession = await livePlayer.get("lastSessionData");
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

                livePlayer.destroy();
            }, SOLO_DESTROY_GRACE_MS).unref?.();
        }
    }
});
