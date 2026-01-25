const logger = require("../Util/logger");

module.exports = (client, node) => {
    if (!logger.isDebugFlagEnabled('poru')) return;

    try {
        const nodeName = node?.name ?? node?.options?.name ?? "(unknown)";
        logger.debug(`[PORU] nodeReconnect: ${nodeName}`);
    } catch (e) {
        logger.error("[PORU] nodeReconnect handler error", e);
    }
};