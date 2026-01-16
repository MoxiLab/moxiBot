const fs = require('fs');
const path = require('path');

const files = [
    'Languages/en-US/economy/zones.json',
    'Languages/es-ES/economy/zones.json',
];

function extractVars(str) {
    const vars = new Set();
    String(str).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, v) => {
        vars.add(v);
        return _;
    });
    return [...vars];
}

function keywordize(node, prefix) {
    if (Array.isArray(node)) {
        return node.map((v, i) => keywordize(v, prefix ? `${prefix}.${i}` : String(i)));
    }

    if (node && typeof node === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(node)) {
            const p = prefix ? `${prefix}.${k}` : k;
            out[k] = keywordize(v, p);
        }
        return out;
    }

    if (typeof node === 'string') {
        const vars = extractVars(node);
        const suffix = vars.length ? ` ${vars.map(v => `{{${v}}}`).join(' ')}` : '';
        return `__${prefix}__${suffix}`;
    }

    return node;
}

for (const rel of files) {
    const abs = path.resolve(process.cwd(), rel);
    const raw = fs.readFileSync(abs, 'utf8');
    const json = JSON.parse(raw);
    const transformed = keywordize(json, '');
    fs.writeFileSync(abs, JSON.stringify(transformed, null, 2) + '\n', 'utf8');
    console.log(`OK keywordized: ${rel}`);
}
