const fs = require('fs');
const path = require('path');

function listJs(dir) {
  let out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(listJs(p));
    else if (ent.isFile() && ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const root = path.join(__dirname, '..');
const files = listJs(path.join(root, 'Slashcmd'));

const failed = [];
for (const f of files) {
  try {
    require(f);
  } catch (e) {
    failed.push({
      file: path.relative(root, f),
      msg: e && e.message ? String(e.message) : String(e),
    });
  }
}

console.log('Slashcmd total', files.length, 'failed', failed.length);
for (const x of failed.slice(0, 30)) {
  console.log('-', x.file, '->', x.msg);
}

process.exit(failed.length ? 1 : 0);
