/*
 * Carga de forma “segura” la mayor parte del repo para detectar roturas de require
 * (APIs de discord.js v15, exports eliminados, etc.).
 *
 * Nota: esto NO sustituye a pruebas funcionales en Discord, pero sí detecta
 * errores de importación/ejecución en load-time.
 */

process.env.TEST_MODE = '1';

const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');

const ROOTS_TO_SCAN = [
  'Slashcmd',
  'Comandos',
  'Eventos',
  'Components',
  'Util',
  'Handlers',
  'Functions',
  'poruEvent',
];

const SKIP_FILES = new Set([
  // entrypoints / scripts que arrancan cosas
  path.join(workspaceRoot, 'index.js'),
  path.join(workspaceRoot, 'sharder.js'),
  path.join(workspaceRoot, 'deploy-commands.js'),
  // wiring principal de handlers: requiere ../index y conecta a Discord/Lavalink/Mongo
  path.join(workspaceRoot, 'Handlers', 'index.js'),
]);

function listJsFiles(dirAbs) {
  const out = [];
  const stack = [dirAbs];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        // saltar node_modules por seguridad
        if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
        stack.push(full);
      } else if (ent.isFile()) {
        if (!ent.name.endsWith('.js')) continue;
        out.push(full);
      }
    }
  }
  return out;
}

function safeRequire(fileAbs) {
  try {
    require(fileAbs);
    return null;
  } catch (err) {
    return {
      file: fileAbs,
      message: err?.message || String(err),
      stack: err?.stack || null,
    };
  }
}

const failures = [];
let total = 0;

for (const rel of ROOTS_TO_SCAN) {
  const abs = path.join(workspaceRoot, rel);
  const files = listJsFiles(abs);
  for (const f of files) {
    if (SKIP_FILES.has(f)) continue;
    total++;
    const fail = safeRequire(f);
    if (fail) failures.push(fail);
  }
}

console.log(`Repo JS load check: total=${total} failed=${failures.length}`);
if (failures.length) {
  for (const f of failures.slice(0, 50)) {
    const rel = path.relative(workspaceRoot, f.file);
    console.error(`\n[FAIL] ${rel}\n${f.message}`);
  }
  if (failures.length > 50) {
    console.error(`\n...and ${failures.length - 50} more`);
  }
  process.exit(1);
}
