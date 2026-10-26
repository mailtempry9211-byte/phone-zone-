#!/usr/bin/env node
/**
 * Developer tool: import a tac_full.xlsx straight into the local database and
 * print the per-sheet report plus 30 RANDOM cleaned rows (brand | phone_name |
 * model | extra | original SPECS) so the cleaning quality can be eyeballed.
 *
 *   cd backend && node scripts/import-tac-cli.mjs D:\sample-data\tac_full.xlsx
 *   (add --overwrite to refresh rows whose source is 'excel')
 *
 * The Excel file is only read - never print its raw rows to the console.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];
const overwrite = process.argv.includes("--overwrite");

if (!file) {
  console.error("Usage: node scripts/import-tac-cli.mjs <path-to-tac_full.xlsx> [--overwrite]");
  process.exit(1);
}

// Default to the project's data folder (the control panel's PHONEZONE_DATA_DIR)
// BEFORE config/paths.js is imported - it reads the env var at import time.
if (!process.env.PHONEZONE_DATA_DIR) {
  process.env.PHONEZONE_DATA_DIR = path.resolve(here, "..", "..", "data");
}

const { initDatabase, closeDatabase, getDb } = await import("../src/db/index.js");
const { importWorkbook } = await import("../src/services/tacService.js");

initDatabase();
try {
  console.log(`Importing ${path.resolve(file)} ...`);
  const report = await importWorkbook(path.resolve(file), { overwrite });

  console.log("\nSheet            dataRows   added   dupes   updated   skipped (blank/zero/test/badlen)");
  for (const s of report.sheets) {
    const k = s.skipped;
    console.log(
      `${(s.name || "").padEnd(16)} ${String(s.dataRows).padStart(8)} ${String(s.added).padStart(8)} ` +
        `${String(s.duplicates).padStart(7)} ${String(s.updated).padStart(9)}   ` +
        `${k.blank}/${k.zero}/${k.testImei}/${k.badLength}`
    );
  }
  console.log(
    `\nTotal inserted/updated this run: ${report.total} | duplicates skipped: ${report.duplicates} | ` +
      `database now holds ${report.databaseTotal} TACs | took ${(report.durationMs / 1000).toFixed(1)}s`
  );

  const rows = getDb()
    .prepare("SELECT brand, phone_name, model, specs, specs_raw FROM tac_codes ORDER BY RANDOM() LIMIT 30")
    .all();
  console.log("\n30 random cleaned rows (brand | phone_name | model | extra | original SPECS):");
  console.log("-".repeat(120));
  for (const r of rows) {
    console.log(
      [r.brand, r.phone_name, r.model, r.specs || "", r.specs_raw || ""]
        .map((v) => String(v).slice(0, 40))
        .join(" | ")
    );
  }
} catch (err) {
  console.error(`\nImport failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  closeDatabase();
}
