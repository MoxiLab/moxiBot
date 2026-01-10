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
logger.startup(`🎶 Lavalink en ${process.env.LAVALINK_NODE_NAME}`)
require("./commands.js")(Moxi);
require("./poru.js")(Moxi);
require("./Eventos.js")(Moxi);