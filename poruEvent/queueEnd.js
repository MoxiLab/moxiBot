const { MessageFlags } = require('discord.js');
const { buildDisabledMusicSessionContainer } = require('../Components/V2/musicControlsComponent');
const { Bot } = require('../Config');
const logger = require('../Util/logger');
const moxi = require('../i18n');
const { sendVoteShare } = require('../Util/sendVoteShare');

module.exports = async (client, player) => {
	logger.info(`[QUEUE END] El bot se ha desconectado del canal de voz en guild: ${player.guildId}`);

	if (!player) return;

	try {
		const lastSession = await player.get('lastSessionData');
		if (client.previousMessage && lastSession) {
			const disabledContainer = buildDisabledMusicSessionContainer({
				title: lastSession.title,
				info: lastSession.info,
				imageUrl: lastSession.imageUrl,
				footerText: '_**Moxi Studios**_ - Sesión Finalizada',
			});

			await client.previousMessage.edit({
				components: [disabledContainer],
				flags: MessageFlags.IsComponentsV2,
			});
		}
	} catch (error) {
		logger.error(`[QUEUE END] Error actualizando el mensaje de colas finalizada: ${error.message}`);
	}

	await sendVoteShare(client, player);

	try {
		await player.destroy();
	} catch (destroyError) {
		logger.error(`[QUEUE END] Error destruyendo el reproductor: ${destroyError.message}`);
	}
};
