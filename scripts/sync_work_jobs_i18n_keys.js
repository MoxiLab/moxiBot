"use strict";

/**
 * Sync WORK_JOB_*_NAME i18n keys into all Languages/<locale>/misc.json files.
 *
 * - Uses Languages/en-US/misc.json as the source of truth.
 * - Adds only missing keys (does not overwrite existing translations).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LANG_DIR = path.join(ROOT, "Languages");
const SOURCE_LOCALE = "en-US";
const SOURCE_FILE = path.join(LANG_DIR, SOURCE_LOCALE, "misc.json");

function readText(filePath) {
    return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, content) {
    fs.writeFileSync(filePath, content, "utf8");
}

function detectNewline(text) {
    return text.includes("\r\n") ? "\r\n" : "\n";
}

function detectIndent(text) {
    const match = text.match(/\{\s*[\r\n]+(\s+)"/);
    return match ? match[1] : "  ";
}

function getJobKeys(sourceObj) {
    const keys = Object.keys(sourceObj).filter((k) => k.startsWith("WORK_JOB_") && k.endsWith("_NAME"));
    keys.sort();
    return keys;
}

function insertBeforeFinalBrace(originalText, insertionText) {
    const trimmedRight = originalText.replace(/[\s\uFEFF\u00A0]+$/, "");
    const lastBraceIndex = trimmedRight.lastIndexOf("}");
    if (lastBraceIndex === -1) {
        throw new Error("Could not find closing brace in target JSON");
    }
    const before = originalText.slice(0, lastBraceIndex);
    const after = originalText.slice(lastBraceIndex);
    return before + insertionText + after;
}

function needsLeadingComma(beforeText) {
    const t = beforeText.replace(/[\s\uFEFF\u00A0]+$/, "");
    if (!t) return false;
    const last = t[t.length - 1];
    return last !== "{" && last !== ",";
}

function syncFile(targetFilePath, sourceKeys, sourceObj) {
    const originalText = readText(targetFilePath);
    const newline = detectNewline(originalText);
    const indent = detectIndent(originalText);

    let targetObj;
    try {
        targetObj = JSON.parse(originalText);
    } catch (err) {
        throw new Error(`Invalid JSON in ${targetFilePath}: ${err.message}`);
    }

    const missingKeys = sourceKeys.filter((k) => !(k in targetObj));
    if (missingKeys.length === 0) {
        return { updated: false, added: 0 };
    }

    const lines = missingKeys.map((k) => `${indent}"${k}": ${JSON.stringify(sourceObj[k])}`);

    const trimmedRight = originalText.replace(/[\s\uFEFF\u00A0]+$/, "");
    const lastBraceIndex = trimmedRight.lastIndexOf("}");
    const beforeBrace = originalText.slice(0, lastBraceIndex);
    const leadingComma = needsLeadingComma(beforeBrace) ? "," : "";

    const insertion = `${leadingComma}${newline}${lines.join("," + newline)}${newline}`;
    const updatedText = insertBeforeFinalBrace(originalText, insertion);

    JSON.parse(updatedText);
    writeText(targetFilePath, updatedText);

    return { updated: true, added: missingKeys.length };
}

function main() {
    if (!fs.existsSync(SOURCE_FILE)) {
        console.error(`Source file not found: ${SOURCE_FILE}`);
        process.exit(1);
    }

    const sourceText = readText(SOURCE_FILE);
    const sourceObj = JSON.parse(sourceText);
    const sourceKeys = getJobKeys(sourceObj);

    const locales = fs
        .readdirSync(LANG_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    const results = [];
    for (const locale of locales) {
        if (locale === SOURCE_LOCALE) continue;

        const targetFilePath = path.join(LANG_DIR, locale, "misc.json");
        if (!fs.existsSync(targetFilePath)) continue;

        const res = syncFile(targetFilePath, sourceKeys, sourceObj);
        results.push({ locale, ...res });
    }

    const updated = results.filter((r) => r.updated);
    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);

    console.log(`Checked ${results.length} locales (excluding ${SOURCE_LOCALE}).`);
    console.log(`Updated ${updated.length} files; added ${totalAdded} missing WORK_JOB_* keys.`);
    if (updated.length > 0) {
        console.log(
            "Updated locales:",
            updated.map((u) => `${u.locale}(+${u.added})`).join(", "),
        );
    }
}

main();
