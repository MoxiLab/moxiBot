const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const languagesDir = path.join(repoRoot, 'Languages');

const BASE_LANG = process.argv[2] || 'en-US';
const FILE_NAME = 'commands.json';

function listLanguageDirs() {
    return fs
        .readdirSync(languagesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
}

function stripBom(s) {
    if (typeof s !== 'string') return s;
    return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function readJsonSafe(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const raw = stripBom(fs.readFileSync(filePath, 'utf8'));
        return JSON.parse(raw);
    } catch (e) {
        return { __error: e?.message || String(e) };
    }
}

function writeJsonPretty(filePath, obj) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 4) + '\n', 'utf8');
}

function isPlainObject(x) {
    return x && typeof x === 'object' && !Array.isArray(x);
}

// Merge keys that are missing in `target` from `source`.
// Does not overwrite existing keys.
function deepMergeMissing(target, source) {
    if (!isPlainObject(target) || !isPlainObject(source)) return target;

    for (const [k, v] of Object.entries(source)) {
        if (!(k in target)) {
            target[k] = v;
            continue;
        }
        if (isPlainObject(target[k]) && isPlainObject(v)) {
            deepMergeMissing(target[k], v);
        }
    }

    return target;
}

function main() {
    const langs = listLanguageDirs();
    if (!langs.includes(BASE_LANG)) {
        console.error(`[sync_commands_locales] Base language not found: ${BASE_LANG}`);
        process.exit(2);
    }

    const basePath = path.join(languagesDir, BASE_LANG, FILE_NAME);
    const baseJson = readJsonSafe(basePath);
    if (!baseJson || baseJson.__error) {
        console.error(`[sync_commands_locales] Invalid base JSON: ${BASE_LANG}/${FILE_NAME}`);
        if (baseJson && baseJson.__error) console.error(baseJson.__error);
        process.exit(2);
    }

    let created = 0;
    let updated = 0;
    let skippedBad = 0;

    for (const lang of langs) {
        const filePath = path.join(languagesDir, lang, FILE_NAME);

        if (!fs.existsSync(filePath)) {
            writeJsonPretty(filePath, baseJson);
            created++;
            continue;
        }

        const json = readJsonSafe(filePath);
        if (!json || json.__error) {
            console.warn(`[sync_commands_locales] Skipping (bad JSON): ${lang}/${FILE_NAME}`);
            if (json && json.__error) console.warn(json.__error);
            skippedBad++;
            continue;
        }

        const before = JSON.stringify(json);
        deepMergeMissing(json, baseJson);
        const after = JSON.stringify(json);

        if (before !== after) {
            writeJsonPretty(filePath, json);
            updated++;
        }
    }

    console.log(`[sync_commands_locales] Done.`);
    console.log(`Base: ${BASE_LANG}/${FILE_NAME}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped bad JSON: ${skippedBad}`);
}

main();
