
const logger = require("../Util/logger");
const { EMOJIS } = require("../Util/emojis");

module.exports = async (Moxi) => {
  const { getFiles } = require("./getFiles");
  const commands = await getFiles("poruEvent");
  const eventos = [];
  for (const file of commands) {
    try {
      const pull = require(file);
      pull.event = file.match(/[^\\\/]+(?=\.js$)/)[0];
      Moxi.poru.on(pull.event, pull.bind(null, Moxi));
      eventos.push(`• ${pull.event}`);
    } catch (err) {
      logger.error(`Error al cargar el evento poru: \n${err}`);
    }
  }
  if (eventos.length) {
    logger.startup(`${EMOJIS.hotdog} Eventos poru cargados (${eventos.length})`);
  }
};

