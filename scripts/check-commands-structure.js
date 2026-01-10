const path = require('path');
const { getFiles } = require('../Handlers/getFiles');

(async () => {
    const files = getFiles('Comandos');
    const problems = [];
    for (const f of files) {
        const base = String(f).split(/[/\\]/g).pop() || '';
        if (base.startsWith('_')) continue;
        try {
            const mod = require(f);
            const hasName = !!mod.name;
            const hasNameAlt = !!mod.Name;
            const hasExec = typeof mod.execute === 'function' || typeof mod.run === 'function' || typeof mod.messageRun === 'function' || typeof mod.interactionRun === 'function';
            if (!hasName && !hasNameAlt) {
                problems.push({ file: f, issue: 'Missing name/Name property' });
                continue;
            }
            if (!hasExec) {
                problems.push({ file: f, issue: 'Missing executable function (execute/run/messageRun/interactionRun)' });
                continue;
            }
        } catch (err) {
            problems.push({ file: f, issue: `Require error: ${err && err.message}` });
        }
    }
    if (problems.length === 0) {
        console.log('No structural problems detected in Comandos/*');
        process.exit(0);
    }
    console.log('Problems detected:');
    for (const p of problems) console.log(`- ${p.file}: ${p.issue}`);
    process.exit(1);
})();
