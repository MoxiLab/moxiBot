const logger = require("../Util/logger");

module.exports = (client, ...args) => {
    logger.error("Poru encountered an error with Node.", ...args);    
};
