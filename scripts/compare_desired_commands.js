/*
  Compara una lista de comandos deseados contra los comandos implementados en:
  - Comandos/** (prefijo)
  - Slashcmd/** (slash)

  Uso:
    node scripts/compare_desired_commands.js
*/

const fs = require('fs');
const path = require('path');

const desired = `auction bag balance buffs buy carnival chop claimcode collect craft crime daily deposit event fish fortune gift give guide iteminfo leaderboard market mine mix nekodex nekoshop pet profile quest race rank repair sell servershop settings share shop slots storage trade use withdraw work xmas`
    .split(/\s+/)
    .filter(Boolean);

function listFiles(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...listFiles(p));
        else if (ent.isFile() && ent.name.endsWith('.js')) out.push(p);
    }
    return out;
}

function extractPrefixName(file) {
    const s = fs.readFileSync(file, 'utf8');
    const m = s.match(/\bname\s*:\s*['"]([^'"]+)['"]/);
    return m ? m[1] : null;
}

function extractSlashName(file) {
    const s = fs.readFileSync(file, 'utf8');
    const m = s.match(/\.setName\(['"]([^'"]+)['"]\)/);
    if (m) return m[1];
    const n = s.match(/\bname\s*:\s*['"]([^'"]+)['"]/);
    return n ? n[1] : null;
}

function main() {
    const root = process.cwd();
    const prefixFiles = listFiles(path.join(root, 'Comandos'));
    const slashFiles = listFiles(path.join(root, 'Slashcmd'));

    const prefixNames = new Set(prefixFiles.map(extractPrefixName).filter(Boolean));
    const slashNames = new Set(slashFiles.map(extractSlashName).filter(Boolean));

    const missingPrefix = desired.filter((n) => !prefixNames.has(n));
    const missingSlash = desired.filter((n) => !slashNames.has(n));

    console.log('desired:', desired.length);
    console.log('prefix existing:', prefixNames.size);
    console.log('slash existing:', slashNames.size);
    console.log('missing prefix:', missingPrefix.join(' '));
    console.log('missing slash:', missingSlash.join(' '));
}

main();
