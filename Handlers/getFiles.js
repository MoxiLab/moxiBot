const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function getFiles(dir) {
  const filePath = path.join(root, dir);
  return fs.readdirSync(filePath).flatMap((file) => {
    const stat = fs.lstatSync(path.join(filePath, file));
    if (stat.isDirectory()) return getFiles(path.join(dir, file));
    if (!file.endsWith(".js")) return [];
    return path.join(filePath, file);
  });
}

module.exports = { getFiles };