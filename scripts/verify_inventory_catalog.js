// Verifica que el catálogo de inventario sea JSON válido y que todos los items tengan id único.

const fs = require('fs');

const filePath = 'Models/InventoryItems.json';
const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(raw);

const items = data.flatMap((c) => c.items || []);
const missingId = items.filter((i) => !i.id).length;
const ids = items.map((i) => i.id);
const uniqueIds = new Set(ids).size;

console.log('JSON OK; categories=', data.length, 'items=', items.length, 'missingId=', missingId, 'uniqueIds=', uniqueIds);
if (missingId !== 0) process.exitCode = 2;
if (uniqueIds !== items.length) process.exitCode = 3;
