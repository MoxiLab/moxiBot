require('../Util/silentDotenv')();

const logger = require('../Util/logger');
const { ensureMongoConnection, mongoose } = require('../Util/mongoConnect');
const loadCommands = require('../Handlers/commands');
const { syncCommandRegistry } = require('../Util/commandRegistry');

function getArgValue(flag) {
    const argv = process.argv || [];
    const idx = argv.indexOf(flag);
    if (idx === -1) return null;
    const next = argv[idx + 1];
    if (!next || next.startsWith('-')) return null;
    return String(next);
}

async function main() {
    if (!process.env.MONGODB) {
        console.error('Falta MONGODB en el entorno/.env');
        process.exit(1);
    }

    const argBotId = getArgValue('--botId') || getArgValue('--bot-id');
    const botIdFromEnv = process.env.CLIENT_ID || process.env.BOT_ID || process.env.APPLICATION_ID;
    const botId = String(argBotId || botIdFromEnv || '').trim();

    // Si sync usa un botId distinto al del bot real, parecerá que “se agregan” comandos
    // (en realidad son entradas separadas por botId). Por eso priorizamos CLIENT_ID.
    if (!botId) {
        console.warn(
            '[WARN] Falta CLIENT_ID/BOT_ID. El sync usará botId="local-script" y verás registros duplicados por botId. ' +
            'Solución: añade CLIENT_ID al .env o ejecuta: node scripts/syncCommandRegistry.js --botId <CLIENT_ID>'
        );
    }

    // Dummy client suficientemente parecido para cargar módulos
    const Moxi = { commands: null, slashcommands: null, user: { id: botId || 'local-script' } };

    await loadCommands(Moxi);
    await ensureMongoConnection();

    const purgeBotId = getArgValue('--purgeBotId') || getArgValue('--purge-botId') || getArgValue('--purge-botid');
    if (purgeBotId) {
        try {
            // eslint-disable-next-line global-require
            const CommandRegistry = require('../Models/CommandRegistrySchema');
            const { deletedCount } = await CommandRegistry.deleteMany({ botId: String(purgeBotId).trim() });
            logger.info(`[commandRegistry] purgeBotId=${purgeBotId} deleted=${deletedCount}`);
        } catch (e) {
            logger.warn(`[commandRegistry] purgeBotId failed: ${e?.message || e}`);
        }
    }

    const res = await syncCommandRegistry(Moxi, { enabled: true, deleteMissing: true });

    if (res && res.ok) logger.info('OK: CommandRegistry sincronizado.');
    else logger.warn('WARN: No se pudo sincronizar CommandRegistry. Revisa permisos/URI de MongoDB.');

    await mongoose.disconnect().catch(() => null);
    process.exit(res && res.ok ? 0 : 2);
}

main().catch((e) => {
    console.error('syncCommandRegistry failed:', e);
    process.exit(1);
});
