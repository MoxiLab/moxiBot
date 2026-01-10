const fs = require('fs');
const path = require('path');

function findDuplicateKeys(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const keys = [];
    const duplicates = [];

    lines.forEach((line, index) => {
      const match = line.match(/^\s*\"([^\"]+)\":/);
      if (match) {
        const key = match[1];
        if (keys.includes(key)) {
          duplicates.push({ key, line: index + 1, previousLine: keys.lastIndexOf(key) + 1 });
        } else {
          keys.push(key);
        }
      }
    });

    if (duplicates.length > 0) {
      console.log('📁', filePath);
      duplicates.forEach(d => {
        console.log('  ❌ Duplicada:', d.key, '(línea', d.line, '- anterior en línea', d.previousLine, ')');
      });
      console.log('');
    }
  } catch (err) {
    console.log('Error leyendo', filePath, ':', err.message);
  }
}

// Buscar en archivos de idiomas
const languagesPath = path.join(__dirname, '..', 'Languages');
const dirs = fs.readdirSync(languagesPath).filter(f => fs.statSync(path.join(languagesPath, f)).isDirectory());

dirs.forEach(dir => {
  const dirPath = path.join(languagesPath, dir);
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

  files.forEach(file => {
    findDuplicateKeys(path.join(dirPath, file));
  });
});

console.log('✅ Análisis completado');
