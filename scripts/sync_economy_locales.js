const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const languagesDir = path.join(repoRoot, 'Languages');

const baseLang = process.argv[2] || 'en-US';
const dryRun = process.argv.includes('--dry-run');

function listLanguageDirs() {
    if (!fs.existsSync(languagesDir)) return [];
    return fs
        .readdirSync(languagesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b));
}

function listJsonFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.json'))
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b));
}

function readJson(filePath) {
    let raw = fs.readFileSync(filePath, 'utf8');
    // Some JSON files may contain an UTF-8 BOM (common on Windows). JSON.parse() will fail on it.
    if (raw && raw.charCodeAt(0) === 0xfeff) {
        raw = raw.slice(1);
    }
    return JSON.parse(raw);
}

function ensureDir(dir) {
    if (fs.existsSync(dir)) return;
    fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, obj) {
    const out = JSON.stringify(obj, null, 4) + '\n';
    fs.writeFileSync(filePath, out, 'utf8');
}

function isPlainObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
}

function deepMergeMissing(target, base) {
    // Adds keys from base into target only when missing.
    // Recurses into nested objects.
    if (!isPlainObject(base)) return target;
    if (!isPlainObject(target)) target = {};

    for (const [key, baseVal] of Object.entries(base)) {
        if (!(key in target)) {
            target[key] = baseVal;
            continue;
        }

        const cur = target[key];
        if (isPlainObject(cur) && isPlainObject(baseVal)) {
            target[key] = deepMergeMissing(cur, baseVal);
        }
    }
    return target;
}

function main() {
    const baseEconomyDir = path.join(languagesDir, baseLang, 'economy');
    if (!fs.existsSync(baseEconomyDir)) {
        console.error(`Base economy folder not found: Languages/${baseLang}/economy`);
        process.exit(2);
    }

    const baseFiles = listJsonFiles(baseEconomyDir);
    if (!baseFiles.length) {
        console.error(`No economy .json files found in base language: Languages/${baseLang}/economy`);
        process.exit(2);
    }

    const langs = listLanguageDirs();
    const targetLangs = langs.filter((l) => l !== baseLang);

    const summary = {
        baseLang,
        baseFiles,
        dryRun,
        createdFiles: 0,
        mergedFiles: 0,
        unchangedFiles: 0,
        errors: [],
    };

    for (const lang of targetLangs) {
        const langEconomyDir = path.join(languagesDir, lang, 'economy');
        if (!dryRun) ensureDir(langEconomyDir);

        for (const fileName of baseFiles) {
            const basePath = path.join(baseEconomyDir, fileName);
            const targetPath = path.join(langEconomyDir, fileName);

            let baseJson;
            try {
                baseJson = readJson(basePath);
            } catch (e) {
                summary.errors.push({ lang: baseLang, file: `economy/${fileName}`, err: e.message });
                continue;
            }

            if (!fs.existsSync(targetPath)) {
                summary.createdFiles++;
                if (!dryRun) writeJson(targetPath, baseJson);
                continue;
            }

            let targetJson;
            try {
                targetJson = readJson(targetPath);
            } catch (e) {
                // If target JSON is invalid, do not overwrite automatically.
                summary.errors.push({ lang, file: `economy/${fileName}`, err: `Invalid JSON: ${e.message}` });
                continue;
            }

            const merged = deepMergeMissing(structuredClone(targetJson), baseJson);
            const changed = JSON.stringify(merged) !== JSON.stringify(targetJson);
            if (!changed) {
                summary.unchangedFiles++;
                continue;
            }

            summary.mergedFiles++;
            if (!dryRun) writeJson(targetPath, merged);
        }
    }

    console.log(`Base: ${baseLang}`);
    console.log(`Economy files: ${baseFiles.length}`);
    console.log(`Targets: ${targetLangs.length} languages`);
    console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`);
    console.log(`Created files: ${summary.createdFiles}`);
    console.log(`Merged files: ${summary.mergedFiles}`);
    console.log(`Unchanged files: ${summary.unchangedFiles}`);
    console.log(`Errors: ${summary.errors.length}`);
    if (summary.errors.length) {
        console.log('ERRORS=' + JSON.stringify(summary.errors, null, 2));
    }
}

main();
