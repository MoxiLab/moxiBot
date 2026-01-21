#!/usr/bin/env node
/*
 * Audit i18n "clone" strings: values in Languages/<locale> that are exactly identical
 * to Languages/es-ES for the same file + key path.
 *
 * Usage:
 *   node scripts/auditI18nClones.js
 *   node scripts/auditI18nClones.js --locale en-US
 *   node scripts/auditI18nClones.js --locale en-US --details --limit 200
 */

const fs = require('fs');
const path = require('path');

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function walk(value, fn, prefix = []) {
    if (Array.isArray(value)) {
        value.forEach((v, idx) => walk(v, fn, prefix.concat(String(idx))));
        return;
    }
    if (isPlainObject(value)) {
        for (const key of Object.keys(value)) {
            walk(value[key], fn, prefix.concat(key));
        }
        return;
    }
    fn(value, prefix);
}

function flattenStrings(json) {
    const out = [];
    walk(json, (value, keyPath) => {
        if (typeof value === 'string') {
            out.push({ keyPath: keyPath.join('.'), value });
        }
    });
    return out;
}

function readJsonSafe(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function listJsonFilesRecursive(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...listJsonFilesRecursive(full));
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
            results.push(full);
        }
    }
    return results;
}

function parseArgs(argv) {
    const args = { base: 'es-ES', locale: null, details: false, limit: 50, file: null };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--base') {
            args.base = argv[++i] || args.base;
        } else if (a === '--locale') {
            args.locale = argv[++i] || null;
        } else if (a === '--details') {
            args.details = true;
        } else if (a === '--file') {
            args.file = (argv[++i] || '').replace(/\\/g, '/');
        } else if (a === '--limit') {
            const n = Number(argv[++i]);
            if (Number.isFinite(n) && n > 0) args.limit = n;
        }
    }
    return args;
}

function main() {
    const { base: baseLocale, locale: onlyLocale, details, limit, file: onlyFile } = parseArgs(process.argv);

    const root = path.resolve(__dirname, '..');
    const languagesDir = path.join(root, 'Languages');
    const baseDir = path.join(languagesDir, baseLocale);

    if (!fs.existsSync(languagesDir) || !fs.existsSync(baseDir)) {
        console.error('Missing Languages/ or Languages/es-ES folder');
        process.exitCode = 1;
        return;
    }

    const locales = fs
        .readdirSync(languagesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((l) => l !== baseLocale);

    const targetLocales = onlyLocale ? locales.filter((l) => l === onlyLocale) : locales;
    if (onlyLocale && targetLocales.length === 0) {
        console.error('Locale not found:', onlyLocale);
        process.exitCode = 1;
        return;
    }

    const baseFiles = listJsonFilesRecursive(baseDir).map((abs) => path.relative(baseDir, abs));

    const summary = [];
    for (const loc of targetLocales) {
        const locDir = path.join(languagesDir, loc);
        const perFile = [];
        let same = 0;
        let total = 0;
        let parsedPairs = 0;

        for (const rel of baseFiles) {
            const bPath = path.join(baseDir, rel);
            const lPath = path.join(locDir, rel);
            if (!fs.existsSync(lPath)) continue;

            const bJson = readJsonSafe(bPath);
            const lJson = readJsonSafe(lPath);
            if (!bJson || !lJson) continue;
            parsedPairs++;

            const bFlat = flattenStrings(bJson);
            const lFlat = flattenStrings(lJson);
            const bMap = new Map(bFlat.map((x) => [x.keyPath, x.value]));

            let fileSame = 0;
            let fileTotal = 0;
            const sameKeys = [];

            for (const { keyPath, value } of lFlat) {
                if (!bMap.has(keyPath)) continue;
                fileTotal++;
                if (value === bMap.get(keyPath)) {
                    fileSame++;
                    if (details) sameKeys.push(keyPath);
                }
            }

            same += fileSame;
            total += fileTotal;
            if (fileTotal > 0) {
                perFile.push({ rel, same: fileSame, total: fileTotal, pct: (fileSame / fileTotal) * 100, sameKeys });
            }
        }

        perFile.sort((a, b) => b.same - a.same);
        summary.push({ locale: loc, same, total, pct: total ? (same / total) * 100 : 0, parsedPairs, perFile });
    }

    summary.sort((a, b) => b.pct - a.pct);
    console.log('i18n clone audit vs ' + baseLocale + ' (all JSON under Languages/<locale>)');
    for (const r of summary) {
        console.log(r.locale + '\t' + r.same + '/' + r.total + '\t' + r.pct.toFixed(2) + '%\tfiles=' + r.parsedPairs);
    }

    if (onlyLocale) {
        const r = summary[0];
        console.log('\nTop files with identical strings for ' + r.locale + ':');
        for (const f of r.perFile.slice(0, 15)) {
            console.log('- ' + f.rel + ': ' + f.same + '/' + f.total + ' (' + f.pct.toFixed(2) + '%)');
        }

        if (details) {
            const needle = onlyFile ? onlyFile.replace(/\\/g, '/').replace(/^\//, '') : null;
            const target = needle
                ? r.perFile.find((x) => x.rel.replace(/\\/g, '/') === needle)
                : r.perFile.find((x) => x.same > 0);

            if (!target) {
                console.log('\nNo matching file with identical strings found for details.');
            } else {
                console.log('\nDetails (first ' + limit + ') for ' + target.rel + ':');
                target.sameKeys.slice(0, limit).forEach((k) => console.log('  ' + k));
            }
        }
    }
}

main();
