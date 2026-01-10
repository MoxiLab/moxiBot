const path = require('node:path');

const { getFiles } = require(path.join(__dirname, '..', 'Handlers', 'getFiles'));

const files = getFiles('Comandos');
let ok = 0;
let fail = 0;
let warn = 0;

for (const file of files) {
    // Ignora helpers internos (por ejemplo, _utils.js)
    if (path.basename(file).startsWith('_')) continue;
    try {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        const mod = require(file);
        if (!mod || typeof mod !== 'object') {
            warn++;
            console.log('[WARN] export inválido (no objeto):', file);
            continue;
        }
        // Compat: algunos comandos nuevos usan `Name` en vez de `name`
        const commandName = mod.name || mod.Name;
        if (!commandName) {
            warn++;
            console.log('[WARN] falta name:', file);
        }
        ok++;
    } catch (err) {
        fail++;
        console.log('\n[FAIL]', file);
        console.log(err && err.stack ? err.stack : err);
    }
}

console.log(`\nComandos total=${files.length} ok=${ok} warn=${warn} fail=${fail}`);
process.exit(fail ? 1 : 0);
