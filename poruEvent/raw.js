const logger = require("../Util/logger");

module.exports = (client, source, packet) => {
  // No spamear consola por defecto.
  if (!logger.isDebugFlagEnabled('poru')) return;

  try {
    // Evita spam: solo mensajes clave para diagnosticar "no suena"
    if (!packet || typeof packet !== "object") return;

    if (source === "Node" && packet.op === "ready") {
      logger.debug(
        `[PORU] Lavalink READY: sessionId=${packet.sessionId ?? "?"} resumed=${packet.resumed ?? "?"}`
      );
      return;
    }

    if (source === "Node" && packet.op === "event" && packet.type === "TrackExceptionEvent") {
      logger.error(
        `[PORU] TrackExceptionEvent guild=${packet.guildId ?? "?"} | ${packet.exception?.message ?? "(no message)"}`,
        packet
      );
      return;
    }

    if (source === "Node" && packet.op === "event" && packet.type === "TrackStuckEvent") {
      logger.warn(`[PORU] TrackStuckEvent guild=${packet.guildId ?? "?"} thresholdMs=${packet.thresholdMs ?? "?"}`);
      return;
    }
  } catch (e) {
    logger.error("[PORU] raw handler error", e);
  }
};
