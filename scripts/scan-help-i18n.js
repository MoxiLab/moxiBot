const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const helpFiles = [
    'Util/getHelpContent.js',
    'Util/buildHelpEmbed.js',
    'Slashcmd/Tools/help.js',
    'Comandos/Tools/help.js',
    'Eventos/InteractionCreate/interactionCreate.js',
    'Eventos/InteractionCreate/controllers/button.js',
    'Eventos/InteractionCreate/controllers/selectMenu.js'
].map((p) => path.join(repoRoot, p));

const translateCallRegex = /moxi\.translate\(\s*['"`]([^'"`]+)['"`]/g;

function extractKeysFromFile(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const text = fs.readFileSync(filePath, 'utf8');
    const keys = [];
    let match;
    while ((match = translateCallRegex.exec(text))) keys.push(match[1]);
    return keys;
}

const keys = new Set();
for (const filePath of helpFiles) {
    for (const key of extractKeysFromFile(filePath)) keys.add(key);
}

console.log(JSON.stringify([...keys].sort(), null, 2));
