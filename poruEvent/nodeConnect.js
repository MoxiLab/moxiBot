const logger = require("../Util/logger");

module.exports = (client, node) => {
	// No spamear consola por defecto.
	if (!logger.isDebugFlagEnabled('poru')) return;

	try {
		logger.debug(
			`[PORU] nodeConnect: ${node?.name ?? node?.options?.name ?? "(unknown)"} | sessionId=${node?.sessionId ?? "null"} | ws=${node?.socketURL ?? ""}`
		);
	} catch (e) {
		logger.error("[PORU] nodeConnect handler error", e);
	}
};
