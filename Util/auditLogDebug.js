// Debugger para eventos de AuditLog
const debugHelper = require('./debugHelper');

function auditLogDebug(...args) {
    debugHelper.log('auditlog', ...args);
}

module.exports = auditLogDebug;
