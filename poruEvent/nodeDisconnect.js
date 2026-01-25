const logger = require("../Util/logger");

module.exports = (client, node, reason) => {
    if (!logger.isDebugFlagEnabled('poru')) return;

    try {
        const nodeName = node?.name ?? node?.options?.name ?? "(unknown)";
        logger.debug(
            `[PORU] nodeDisconnect: ${nodeName} | reason=${reason ? JSON.stringify(reason) : "(none)"}`
        );
    } catch (e) {
        logger.error("[PORU] nodeDisconnect handler error", e);
    }
};