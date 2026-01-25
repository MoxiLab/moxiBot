const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function getFiles(dir, options = {}) {
  const ignoreDirs = new Set(
    (Array.isArray(options.ignoreDirs) ? options.ignoreDirs : [])
      .map((s) => String(s || '').trim())
      .filter(Boolean)
  );

  const filePath = path.join(root, dir);
  return fs.readdirSync(filePath).flatMap((file) => {
    const stat = fs.lstatSync(path.join(filePath, file));
    if (stat.isDirectory()) {
      if (ignoreDirs.has(file)) return [];
      return getFiles(path.join(dir, file), options);
    }
    if (!file.endsWith(".js")) return [];
    return path.join(filePath, file);
  });
}

module.exports = { getFiles };