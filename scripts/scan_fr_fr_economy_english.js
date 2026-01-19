/*
  Utility: scan Languages/fr-FR/economy/*.json for English-like text.
  Usage: node scripts/scan_fr_fr_economy_english.js
*/

const fs = require('fs');
const path = require('path');

const econDir = path.join('Languages', 'fr-FR', 'economy');
const files = fs.readdirSync(econDir).filter((f) => f.endsWith('.json'));

const words = [
    ' the ',
    ' and ',
    ' you ',
    ' your ',
    ' allows ',
    ' allow ',
    ' contains ',
    ' increases ',
    ' improves ',
    ' required ',
    ' temporarily ',
    ' chance ',
    ' rewards ',
    ' restore ',
    ' restores ',
    ' unlocks ',
    ' provides ',
    'special ',
    'press ',
    'choose ',
    'still in development',
    // Common error-ish tokens
    'usage',
    'invalid',
    'error',
    "couldn't",
    "can't",
    "you don't",
    'you must',
    'you tried',
];

/** @type {{file:string, trail:string, sample:string}[]} */
const hits = [];

function visit(node, trail, file) {
    if (typeof node === 'string') {
        const s = ` ${node.toLowerCase()} `;
        for (const w of words) {
            if (s.includes(w)) {
                hits.push({ file, trail: trail.join('.'), sample: node.slice(0, 140) });
                break;
            }
        }
        return;
    }

    if (Array.isArray(node)) {
        node.forEach((v, i) => visit(v, trail.concat(`[${i}]`), file));
        return;
    }

    if (node ? typeof node === 'object' : false) {
        for (const [k, v] of Object.entries(node)) {
            visit(v, trail.concat(k), file);
        }
    }
}

for (const file of files) {
    const p = path.join(econDir, file);
    let json;
    try {
        json = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        console.error('JSON parse error', p, String(e));
        process.exitCode = 1;
        continue;
    }
    visit(json, [], file);
}

const byFile = new Map();
for (const h of hits) {
    if (!byFile.has(h.file)) byFile.set(h.file, []);
    byFile.get(h.file).push(h);
}

const list = [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log('fr-FR economy files with English-like text:', list.length);
for (const [file, arr] of list) {
    console.log(`\n- ${file} (${arr.length} hits)`);
    for (const h of arr.slice(0, 12)) {
        console.log(`   ${h.trail} => ${JSON.stringify(h.sample)}`);
    }
    if (arr.length > 12) console.log('   ...');
}
