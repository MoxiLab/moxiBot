const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const languagesDir = path.join(repoRoot, 'Languages');

const required = {
    misc: [
        'PAGE',
        'HELP_TITLE',
        'HELP_HOME_DESCRIPTION',
        'HELP_CATEGORIES_LIST',
        'HELP_SELECT_PLACEHOLDER',
        'HELP_NO_COMMANDS',
        'HELP_NO_CONTENT',
        'HELP_PAGE_TEXT',
        'HELP_WEB_LABEL',
        'HELP_WEB_URL'
    ],
    commands: ['CATEGORY_HERRAMIENTAS', 'CMD_HELP_DESC']
};

function safeJsonRead(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

const langDirs = fs
    .readdirSync(languagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

let badJson = [];
let missing = [];

for (const lang of langDirs) {
    const miss = { lang, misc: [], commands: [] };

    // misc
    const miscPath = path.join(languagesDir, lang, 'misc.json');
    if (fs.existsSync(miscPath)) {
        try {
            const misc = safeJsonRead(miscPath);
            for (const key of required.misc) {
                if (!(key in misc)) miss.misc.push(key);
            }
        } catch (e) {
            badJson.push({ lang, file: 'misc.json', err: e.message });
        }
    } else {
        miss.misc.push(...required.misc);
    }

    // commands
    const commandsPath = path.join(languagesDir, lang, 'commands.json');
    if (fs.existsSync(commandsPath)) {
        try {
            const commands = safeJsonRead(commandsPath);
            for (const key of required.commands) {
                if (!(key in commands)) miss.commands.push(key);
            }
        } catch (e) {
            badJson.push({ lang, file: 'commands.json', err: e.message });
        }
    } else {
        miss.commands.push(...required.commands);
    }

    if (miss.misc.length || miss.commands.length) missing.push(miss);
}

if (badJson.length) {
    console.log('Bad JSON files:', badJson.length);
    for (const r of badJson) console.log('-', r.lang, r.file, r.err);
}

console.log('Languages with missing help-related keys:', missing.length);
for (const r of missing) {
    const parts = [];
    if (r.misc.length) parts.push(`misc:${r.misc.length}`);
    if (r.commands.length) parts.push(`commands:${r.commands.length}`);
    console.log('-', r.lang, '=>', parts.join(' | '));
}

// Emit a machine-friendly JSON summary at the end.
console.log('\nJSON_SUMMARY=' + JSON.stringify({ badJson, missing }, null, 2));
