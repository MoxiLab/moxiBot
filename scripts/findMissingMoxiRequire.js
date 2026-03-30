const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p, out);
        else if (ent.isFile() && p.endsWith('.js')) out.push(p);
    }
    return out;
}

function hasMoxiRequire(source) {
    // Support both ../../i18n and ..\\..\\i18n formatting.
    return /\bconst\s+moxi\s*=\s*require\((['"])\.\.\/[\s]*\.\.\/i18n\1\)\s*;?/m.test(source)
        || /\bconst\s+moxi\s*=\s*require\((['"])\.\.\\\\[\s]*\.\.\\\\i18n\1\)\s*;?/m.test(source);
}

const root = path.join(process.cwd(), 'Comandos');
const files = fs.existsSync(root) ? walk(root) : [];

const missing = [];
for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (/\bmoxi\.translate\(/.test(src) && !hasMoxiRequire(src)) {
        missing.push(path.relative(process.cwd(), file));
    }
}

console.log(missing.sort().join('\n'));
