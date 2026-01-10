const fs = require('fs');
const path = require('path');
const languagesDir = path.join(process.cwd(), 'Languages');
const en = JSON.parse(fs.readFileSync(path.join(languagesDir, 'en-US', 'misc.json'), 'utf8'));
const locales = fs.readdirSync(languagesDir).filter(name => {
    const full = path.join(languagesDir, name);
    return fs.statSync(full).isDirectory() && name !== 'en-US';
});
let missing = [];
for (const locale of locales) {
    const file = path.join(languagesDir, locale, 'misc.json');
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const matches = Object.keys(en).filter(key => data[key] === en[key]);
    if (matches.length > 0) {
        missing.push({ locale, matches });
    }
}
if (missing.length === 0) {
    console.log('No locales with en-US matches found.');
} else {
    for (const entry of missing) {
        console.log(`${entry.locale}: ${entry.matches.length} matches`);
        console.log(entry.matches.join(', '));
        console.log('---');
    }
}
