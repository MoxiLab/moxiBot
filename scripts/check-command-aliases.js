const { getFiles } = require('../Handlers/getFiles');

const normalizeKey = (value) => {
    if (value === undefined || value === null) return '';
    return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

const extract = (mod) => {
    // Formato "actual" (name/alias)
    if (mod && typeof mod === 'object' && mod.name) {
        const name = normalizeKey(mod.name);
        const aliasArr = Array.isArray(mod.alias)
            ? mod.alias
            : (Array.isArray(mod.aliases) ? mod.aliases : []);
        const alias = Array.from(new Set(aliasArr.map(normalizeKey).filter(Boolean)));
        return { name, alias };
    }

    // Formato alternativo (Name/Aliases)
    if (mod && typeof mod === 'object' && mod.Name) {
        const name = normalizeKey(mod.Name);
        const aliasArr = Array.isArray(mod.Aliases) ? mod.Aliases : [];
        const alias = Array.from(new Set(aliasArr.map(normalizeKey).filter(Boolean)));
        return { name, alias };
    }

    return null;
};

(async () => {
    const files = getFiles('Comandos');
    const problems = [];

    for (const f of files) {
        const base = String(f).split(/[/\\]/g).pop() || '';
        if (base.startsWith('_')) continue;

        let mod;
        try {
            mod = require(f);
        } catch (err) {
            problems.push({ file: f, issue: `Require error: ${err && err.message}` });
            continue;
        }

        const info = extract(mod);
        if (!info || !info.name) {
            // Ya lo valida check-commands-structure, aquí solo alias
            continue;
        }

        if (!Array.isArray(info.alias) || info.alias.length === 0) {
            problems.push({ file: f, issue: `Command '${info.name}' has no alias array or it's empty` });
            continue;
        }
    }

    if (problems.length === 0) {
        console.log('OK: todos los comandos en Comandos/* tienen alias');
        process.exit(0);
    }

    console.log('Faltan alias en estos comandos:');
    for (const p of problems) console.log(`- ${p.file}: ${p.issue}`);
    process.exit(1);
})();
