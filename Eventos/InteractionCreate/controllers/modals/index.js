const timerModal = require('./timer');
const channelModal = require('./channel');

const handlers = [timerModal, channelModal];

module.exports = async function modalController(interaction, Moxi, logger) {
    for (const handler of handlers) {
        try {
            if (await handler(interaction, Moxi, logger)) return;
        } catch (error) {
            if (logger && logger.error) logger.error(error);
        }
    }
};
