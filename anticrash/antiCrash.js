
const logger = require('../Util/logger');
const { sendErrorToWebhook } = require('../Util/webhookError');

module.exports = () => {
	process.on('unhandledRejection', (reason, p) => {
		logger.error('Unhandled Rejection/Catch:', reason, p);
		sendErrorToWebhook('Unhandled Rejection/Catch', reason && reason.stack ? reason.stack : String(reason));
	});
	process.on('uncaughtException', (err, origin) => {
		logger.error('Uncaught Exception/Catch:', err, origin);
		sendErrorToWebhook('Uncaught Exception/Catch', err && err.stack ? err.stack : String(err));
	});
	process.on('uncaughtExceptionMonitor', (err, origin) => {
		logger.error('Uncaught Exception Monitor:', err, origin);
		sendErrorToWebhook('Uncaught Exception Monitor', err && err.stack ? err.stack : String(err));
	});
};
