const logger = require("../Util/logger");

module.exports = (client, node) => {
    try {
        const nodeName = node?.name ?? node?.options?.name ?? "(unknown)";
        logger.warn(`[PORU] nodeReconnect: ${nodeName}`);
    } catch (e) {
        logger.error("[PORU] nodeReconnect handler error", e);
    }
};