const timerModal = require('./timer');
const channelModal = require('./channel');
const shopModal = require('./shop');
const suggestModal = require('./suggest');
const petModal = require('./pet');
const verificationModal = require('./verification');

const handlers = [verificationModal, timerModal, channelModal, shopModal, suggestModal, petModal];

module.exports = async function modalController(interaction, Moxi, logger) {
    for (const handler of handlers) {
        try {
            if (await handler(interaction, Moxi, logger)) return;
        } catch (error) {
            if (logger && logger.error) logger.error(error);
        }
    }
};
