const { AsyncLocalStorage } = require('node:async_hooks');

const als = new AsyncLocalStorage();

function runWithCommandContext(context, fn) {
    if (typeof fn !== 'function') return undefined;
    return als.run(context || {}, fn);
}

function getCommandContext() {
    return als.getStore() || null;
}

module.exports = {
    runWithCommandContext,
    getCommandContext,
};
