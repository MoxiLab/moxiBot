// Helper to load dotenv while suppressing its informational output
module.exports = function silentDotenv() {
    if (global.__dotenv_loaded_silently) return;

    // Aumenta el connect timeout de Undici (usado por discord.js REST y fetch en Node)
    // para redes lentas o picos de latencia con Cloudflare/Discord.
    // Configurable con: DISCORD_API_CONNECT_TIMEOUT_MS=30000
    try {
        // eslint-disable-next-line global-require
        const { setGlobalDispatcher, Agent } = require('undici');
        const raw = process.env.DISCORD_API_CONNECT_TIMEOUT_MS;
        const connectTimeout = Number.isFinite(Number(raw)) ? Math.max(1_000, Number(raw)) : 30_000;
        if (!global.__undici_dispatcher_configured) {
            setGlobalDispatcher(new Agent({ connectTimeout }));
            global.__undici_dispatcher_configured = true;
        }
    } catch {
        // ignore
    }

    const saved = { log: console.log, info: console.info, warn: console.warn };
    let envFileExists = false;
    try {
        const fs = require('fs');
        const path = require('path');
        envFileExists = fs.existsSync(path.join(process.cwd(), '.env'));
    } catch {
        envFileExists = false;
    }
    try {
        console.log = () => { };
        console.info = () => { };
        console.warn = () => { };

        try {
            require('dotenv').config();
        } catch {
            // Si dotenv no está instalado, no rompemos el arranque: asumimos variables por entorno.
        }
        global.__dotenv_loaded_silently = true;
    } finally {
        console.log = saved.log;
        console.info = saved.info;
        console.warn = saved.warn;
    }

    // Si faltan variables clave, lo avisamos (esto suele ser el motivo de “no se guarda nada”).
    const missing = [];
    if (!process.env.TOKEN) missing.push('TOKEN');
    if (!process.env.CLIENT_ID) missing.push('CLIENT_ID');
    if (!process.env.MONGODB) missing.push('MONGODB');

    // Evitar ruido en despliegues donde solo se usa entorno y no .env.
    // Aun así, si hay .env y faltan valores, casi seguro es un error de configuración local.
    if (missing.length > 0 && (envFileExists || (!process.env.TOKEN && !process.env.MONGODB))) {
        saved.warn(
            `[WARN] Config incompleta: faltan ${missing.join(', ')}. ` +
            `Sin MONGODB, la economía y otras funciones con base de datos no guardarán nada.`
        );
    }
};
