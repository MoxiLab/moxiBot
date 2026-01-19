const fs = require('fs');
const path = require('path');

const LANGUAGES_DIR = path.join(process.cwd(), 'Languages');

function stripBom(text) {
    return typeof text === 'string' ? text.replace(/^\uFEFF/, '') : text;
}

function rarityForIndex(i) {
    if (i % 200 === 0) return 'legendary';
    if (i % 80 === 0) return 'epic';
    if (i % 25 === 0) return 'rare';
    if (i % 8 === 0) return 'uncommon';
    return 'common';
}

function basePriceForPrefix(prefix) {
    switch (prefix) {
        case 'materiales':
            return 12;
        case 'consumibles':
            return 30;
        case 'coleccionables':
            return 80;
        case 'buffs':
            return 250;
        case 'herramientas':
            return 220;
        case 'llaves':
            return 900;
        case 'loots':
            return 600;
        case 'mascotas':
            return 900;
        case 'mejoras':
            return 1500;
        case 'pociones':
            return 180;
        case 'rollos':
            return 220;
        case 'proteccion':
            return 2500;
        case 'misiones':
            return 200;
        default:
            return 100;
    }
}

function priceForRarity(base, rarity) {
    switch (rarity) {
        case 'uncommon':
            return Math.max(1, Math.trunc(base * 1.6));
        case 'rare':
            return Math.max(1, Math.trunc(base * 3.6));
        case 'epic':
            return Math.max(1, Math.trunc(base * 7.0));
        case 'legendary':
            return Math.max(1, Math.trunc(base * 12.0));
        case 'common':
        default:
            return Math.max(1, Math.trunc(base));
    }
}

const prefixToCategoryKey = {
    buffs: 'Buffs',
    coleccionables: 'Collectibles',
    consumibles: 'Consumables',
    herramientas: 'Tools',
    llaves: 'Keys',
    loots: 'Loot',
    mascotas: 'Pets',
    materiales: 'Materials',
    mejoras: 'Upgrades',
    misiones: 'Quests',
    pociones: 'Potions',
    rollos: 'Scrolls',
    proteccion: 'Protection',
};

const categoryOrder = [
    'Buffs',
    'Collectibles',
    'Consumables',
    'Tools',
    'Keys',
    'Loot',
    'Pets',
    'Materials',
    'Upgrades',
    'Quests',
    'Potions',
    'Scrolls',
    'Protection',
    'Other',
];

function buildCatalogFromItems(itemsJsonPath) {
    const raw = stripBom(fs.readFileSync(itemsJsonPath, 'utf8'));
    const data = JSON.parse(raw);
    const ids = Object.keys(data?.items || {});

    const grouped = new Map();
    for (const id of ids) {
        const prefix = String(id).split('/')[0] || 'other';
        const categoryKey = prefixToCategoryKey[prefix] || 'Other';
        if (!grouped.has(categoryKey)) grouped.set(categoryKey, []);
        grouped.get(categoryKey).push(String(id));
    }

    for (const [k, arr] of grouped.entries()) {
        arr.sort((a, b) => a.localeCompare(b));
        grouped.set(k, arr);
    }

    const catalog = [];
    for (const categoryKey of categoryOrder) {
        const idsForCat = grouped.get(categoryKey);
        if (!idsForCat || !idsForCat.length) continue;

        const items = [];
        for (let i = 0; i < idsForCat.length; i += 1) {
            const id = idsForCat[i];
            const prefix = String(id).split('/')[0] || 'other';
            const rarity = rarityForIndex(i + 1);
            const price = priceForRarity(basePriceForPrefix(prefix), rarity);
            items.push({ id, rarity, price });
        }

        catalog.push({
            categoryKey,
            category: categoryKey,
            items,
        });
    }

    return catalog;
}

function writeCatalogForLang(lang, catalog) {
    const outPath = path.join(LANGUAGES_DIR, lang, 'economy', 'InventoryItems.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
    return outPath;
}

function listLocaleDirs() {
    try {
        return fs
            .readdirSync(LANGUAGES_DIR, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
    } catch {
        return [];
    }
}

function parseArgs(argv) {
    const args = {
        baseLang: 'en-US',
        langsArg: 'en-US,es-ES',
        force: false,
    };

    for (const a of argv) {
        if (a === '--force') args.force = true;
    }

    const positionals = argv.filter((a) => !a.startsWith('--'));
    if (positionals[0]) args.baseLang = positionals[0];
    if (positionals[1]) args.langsArg = positionals[1];
    return args;
}

function resolveTargetLangs(langsArg) {
    const raw = String(langsArg || '').trim();
    if (!raw) return [];
    if (raw === '*' || raw.toLowerCase() === 'all') return listLocaleDirs();
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function shouldWriteCatalog(lang, { force } = {}) {
    const outPath = path.join(LANGUAGES_DIR, lang, 'economy', 'InventoryItems.json');
    return force ? true : !fs.existsSync(outPath);
}

function main() {
    const { baseLang, langsArg, force } = parseArgs(process.argv.slice(2));
    const targetLangs = resolveTargetLangs(langsArg);

    const itemsJsonPath = path.join(LANGUAGES_DIR, baseLang, 'economy', 'items.json');
    if (!fs.existsSync(itemsJsonPath)) {
        console.error('Base items.json not found:', itemsJsonPath);
        process.exit(1);
    }

    const catalog = buildCatalogFromItems(itemsJsonPath);
    if (!Array.isArray(catalog) || !catalog.length) {
        console.error('Generated catalog is empty.');
        process.exit(1);
    }

    if (!targetLangs.length) {
        console.error('No target langs specified. Use "," separated list or "all" / "*".');
        process.exit(1);
    }

    const written = [];
    const skipped = [];
    for (const lang of targetLangs) {
        if (!shouldWriteCatalog(lang, { force })) {
            skipped.push(lang);
            continue;
        }
        written.push(writeCatalogForLang(lang, catalog));
    }

    if (written.length) {
        console.log('OK: wrote InventoryItems.json to:');
        for (const p of written) console.log('-', p);
    } else {
        console.log('No files written. (All targets already had InventoryItems.json)');
    }

    if (skipped.length) {
        console.log('Skipped (already existed):', skipped.join(', '));
        console.log('Tip: re-run with --force to overwrite.');
    }
}

main();
