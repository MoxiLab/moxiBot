const fs = require('fs');

const filePath = 'Languages/en-US/economy/InventoryItems.json';

const slugify = (value) =>
    String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');

const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(raw);

const used = new Set();

for (const categoryBlock of data) {
    const categorySlug = slugify(categoryBlock.category);
    const collisions = new Map();

    categoryBlock.items = categoryBlock.items.map((item) => {
        if (item && typeof item.id === 'string' && item.id.trim()) {
            used.add(item.id);
            return item;
        }

        const baseItemSlug = slugify(item?.name ?? 'item');
        const baseId = `${categorySlug}/${baseItemSlug}`;

        const count = (collisions.get(baseId) ?? 0) + 1;
        collisions.set(baseId, count);

        let candidate = count === 1 ? baseId : `${baseId}-${count}`;
        while (used.has(candidate)) {
            const bump = (collisions.get(baseId) ?? count) + 1;
            collisions.set(baseId, bump);
            candidate = `${baseId}-${bump}`;
        }

        used.add(candidate);

        // Put id first for readability
        return { id: candidate, ...item };
    });
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' });

// Validate + sanity checks
const check = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
const items = check.flatMap((c) => c.items ?? []);
const missing = items.filter((i) => !i.id);
const idCounts = new Map();
for (const it of items) idCounts.set(it.id, (idCounts.get(it.id) ?? 0) + 1);
const dupes = [...idCounts.entries()].filter(([, n]) => n > 1);

if (missing.length || dupes.length) {
    console.error('Failed checks', { missingId: missing.length, duplicateIds: dupes.length });
    process.exit(1);
}

console.log(`OK: added/verified ids for ${items.length} items.`);
