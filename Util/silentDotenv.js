// Helper to load dotenv while suppressing its informational output
module.exports = function silentDotenv() {
    if (global.__dotenv_loaded_silently) return;
    const saved = { log: console.log, info: console.info, warn: console.warn };
    try {
        console.log = () => { };
        console.info = () => { };
        console.warn = () => { };
        require('dotenv').config();
        global.__dotenv_loaded_silently = true;
    } finally {
        console.log = saved.log;
        console.info = saved.info;
        console.warn = saved.warn;
    }
};
