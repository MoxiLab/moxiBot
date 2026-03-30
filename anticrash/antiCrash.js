

const logger = require('../Util/logger');
const { sendErrorToWebhook } = require('../Util/webhookError');

// Set para evitar reportar el mismo error varias veces
const reportedErrors = new Set();

module.exports = () => {
	function handleError(type, error, extra) {
		// Usar el stack o el string del error como clave
		const key = (error && error.stack ? error.stack : String(error)) + (extra ? String(extra) : '');
		if (reportedErrors.has(key)) return;
		reportedErrors.add(key);
		logger.error(`${type}:`, error, extra);
		sendErrorToWebhook(type, error && error.stack ? error.stack : String(error));
		// Limpiar el set después de un tiempo para evitar crecimiento infinito
		setTimeout(() => reportedErrors.delete(key), 10000);
	}

	process.on('unhandledRejection', (reason, p) => {
		handleError('Unhandled Rejection/Catch', reason, p);
	});
	process.on('uncaughtException', (err, origin) => {
		handleError('Uncaught Exception/Catch', err, origin);
	});
	process.on('uncaughtExceptionMonitor', (err, origin) => {
		handleError('Uncaught Exception Monitor', err, origin);
	});
};
