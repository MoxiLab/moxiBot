const { getFiles } = require("./getFiles");
const logger = require("../Util/logger");
const { EMOJIS } = require("../Util/emojis");
module.exports = () => {
  const eventFiles = getFiles("Eventos");
  eventFiles.forEach((value) => require(value));

  logger.startup(`${EMOJIS.pizza} Eventos cargados (${eventFiles.length})`);
};
