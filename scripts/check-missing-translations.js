const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const languagesDir = path.join(repoRoot, 'Languages');

const baseLang = process.argv[2] || 'en-US';

function listLanguageDirs() {
    return fs
        .readdirSync(languagesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
}

function listJsonFiles(lang) {
    const dir = path.join(languagesDir, lang);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.json'))
        .map((d) => d.name)
        .sort();
}

function readJson(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function flattenKeys(obj, prefix = '') {
    const out = [];
    if (!obj || typeof obj !== 'object') return out;

    for (const [key, value] of Object.entries(obj)) {
        const next = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            out.push(...flattenKeys(value, next));
        } else {
            out.push(next);
        }
    }
    return out;
}

function uniqueSorted(arr) {
    return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

function main() {
    const langs = listLanguageDirs();
    if (!langs.includes(baseLang)) {
        console.error(`Base language folder not found: ${baseLang}`);
        process.exit(2);
    }

    const baseFiles = listJsonFiles(baseLang);
    if (!baseFiles.length) {
        console.error(`No .json files found in base language: ${baseLang}`);
        process.exit(2);
    }

    // Build reference key sets per file
    const reference = new Map(); // fileName -> Set(keys)
    for (const fileName of baseFiles) {
        const filePath = path.join(languagesDir, baseLang, fileName);
        let json;
        try {
            json = readJson(filePath);
        } catch (e) {
            console.error(`Invalid JSON in base file ${baseLang}/${fileName}: ${e.message}`);
            process.exit(2);
        }
        reference.set(fileName, new Set(flattenKeys(json)));
    }

    const report = {
        baseLang,
        checkedLangs: langs,
        baseFiles,
        badJson: [],
        missing: [] // { lang, file, missingKeys: [] }
    };

    for (const lang of langs) {
        for (const fileName of baseFiles) {
            const refKeys = reference.get(fileName);
            const filePath = path.join(languagesDir, lang, fileName);

            if (!fs.existsSync(filePath)) {
                report.missing.push({
                    lang,
                    file: fileName,
                    missingKeys: uniqueSorted([...refKeys])
                });
                continue;
            }

            let json;
            try {
                json = readJson(filePath);
            } catch (e) {
                report.badJson.push({ lang, file: fileName, err: e.message });
                continue;
            }

            const present = new Set(flattenKeys(json));
            const missing = [];
            for (const k of refKeys) {
                if (!present.has(k)) missing.push(k);
            }

            if (missing.length) {
                report.missing.push({
                    lang,
                    file: fileName,
                    missingKeys: uniqueSorted(missing)
                });
            }
        }
    }

    // Pretty summary
    const badCount = report.badJson.length;
    const missingCount = report.missing.length;

    console.log(`Base: ${baseLang}`);
    console.log(`Base files: ${baseFiles.length}`);
    console.log(`Bad JSON files: ${badCount}`);
    console.log(`Lang/file pairs with missing keys: ${missingCount}`);

    // Aggregate per language
    const byLang = new Map();
    for (const row of report.missing) {
        const prev = byLang.get(row.lang) || 0;
        byLang.set(row.lang, prev + 1);
    }
    const langsWithMissing = [...byLang.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    if (langsWithMissing.length) {
        console.log('\nMissing summary (lang => #files):');
        for (const [lang, n] of langsWithMissing) console.log(`- ${lang} => ${n}`);
    }

    // Emit JSON for tooling
    console.log('\nJSON_REPORT=' + JSON.stringify(report, null, 2));

    // Exit code: 0 if clean, 1 if missing/bad
    process.exit(badCount || missingCount ? 1 : 0);
}

main();
