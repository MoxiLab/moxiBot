const timerModal = require('./timer');

const handlers = [timerModal];

module.exports = async function modalController(interaction, Moxi, logger) {
    for (const handler of handlers) {
        try {
            if (await handler(interaction, Moxi, logger)) return;
        } catch (error) {
            if (logger && logger.error) logger.error(error);
        }
    }
};
