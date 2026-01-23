const debug = require('./debug');

function isTestMode() {
  return debug.normalizeEnvValue(process.env.TEST_MODE) === '1';
}

module.exports = {
  isTestMode,
};
