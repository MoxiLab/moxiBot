const Moxi = require("../index");
const { Poru } = require("poru");
const { Spotify } = require("poru-spotify");


const nodes = [
  {
    name: process.env.LAVALINK_NODE_NAME,
    host: process.env.LAVALINK_NODE_HOST,
    port: Number(process.env.LAVALINK_NODE_PORT),
    password: process.env.LAVALINK_NODE_PASSWORD,
    secure: String(process.env.LAVALINK_NODE_SECURE).toLowerCase() === 'true'
  }
];

let spotify = new Spotify({
  clientID: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});




Moxi.poru = new Poru(Moxi, nodes, {
  library: "discord.js",
  defaultPlatform: "ytsearch",
  plugins: [spotify]
});

const logger = require("../Util/logger");
// Logs de Poru (activar con PORU_DEBUG=1 o DEBUG_FLAGS=poru)
try {
  Moxi.poru.on("debug", (...args) => {
    // Poru suele emitir (scope, message) pero puede variar.
    const text = args
      .map((a) => (typeof a === 'string' ? a : ''))
      .filter(Boolean)
      .join(' ');

    // Para diagnosticar "no suena": estos mensajes son críticos.
    // Los subimos a info para que salgan incluso si LOG_LEVEL está en info.
    if (
      text.includes('[Voice]') ||
      text.includes('[Player]') ||
      text.includes('VOICE_SERVER_UPDATE') ||
      text.includes('VOICE_STATE_UPDATE')
    ) {
      logger.info('[PORU]', ...args);
      return;
    }

    logger.debug("[PORU]", ...args);
  });
} catch {
  // noop
}
logger.startup(`🎶 Lavalink en ${process.env.LAVALINK_NODE_NAME}`)
require("./commands.js")(Moxi);
require("./poru.js")(Moxi);
require("./Eventos.js")(Moxi);