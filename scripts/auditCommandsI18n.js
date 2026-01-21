const fs = require('fs');
const path = require('path');

function readJsonSafe(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function main() {
    const root = path.resolve(__dirname, '..');
    const languagesDir = path.join(root, 'Languages');

    const baseEs = readJsonSafe(path.join(languagesDir, 'es-ES', 'commands.json')) || {};
    const baseEn = readJsonSafe(path.join(languagesDir, 'en-US', 'commands.json')) || {};
    const baseKeys = Object.keys(baseEs);

    const langs = fs
        .readdirSync(languagesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    const results = [];
    for (const lang of langs) {
        const fp = path.join(languagesDir, lang, 'commands.json');
        const cur = readJsonSafe(fp) || {};

        const missing = baseKeys.filter((k) => !(k in cur));
        const placeholders = Object.entries(cur)
            .filter(([k, v]) => typeof v === 'string' && v.trim() === k.trim())
            .map(([k]) => k);

        if (missing.length || placeholders.length) {
            results.push({ lang, missingCount: missing.length, placeholderCount: placeholders.length });
        }
    }

    results.sort((a, b) => (b.missingCount + b.placeholderCount) - (a.missingCount + a.placeholderCount));

    console.log('commands.json audit (base es-ES)');
    for (const r of results) {
        console.log(`${r.lang}: missing=${r.missingCount} placeholder=${r.placeholderCount}`);
    }

    // Also show a small sample of missing keys for the worst offender
    if (results.length) {
        const worst = results[0];
        const fp = path.join(languagesDir, worst.lang, 'commands.json');
        const cur = readJsonSafe(fp) || {};
        const missing = baseKeys.filter((k) => !(k in cur));

        console.log('\nSample missing keys for', worst.lang);
        console.log(missing.slice(0, 25).join(', '));

        // Bonus: detect keys that exist in es-ES but not in en-US (helps decide fallback)
        const missingInEn = baseKeys.filter((k) => !(k in baseEn));
        if (missingInEn.length) {
            console.log(`\nNote: ${missingInEn.length} base keys are missing in en-US too (will fallback to es-ES if fixing).`);
        }
    }
}

main();
