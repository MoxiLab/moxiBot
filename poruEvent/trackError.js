const logger = require("../Util/logger");

module.exports = (client, player, track, error) => {
	try {
		const guildId = player?.guildId;
		const title = track?.info?.title;
		logger.error("[poru trackError]", {
			guildId,
			title,
			error: error?.message || error,
			raw: error,
		});
	} catch (e) {
		logger.error("[poru trackError] failed to log", e?.message || e);
	}
};
