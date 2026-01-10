const logger = require('../Util/logger');

module.exports = () => {
	process.on('unhandledRejection', (reason, p) => {
		logger.error('Unhandled Rejection/Catch:', reason, p);
	});
	process.on('uncaughtException', (err, origin) => {
		logger.error('Uncaught Exception/Catch:', err, origin);
	});
	process.on('uncaughtExceptionMonitor', (err, origin) => {
		logger.error('Uncaught Exception Monitor:', err, origin);
	});
};
