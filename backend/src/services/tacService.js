/**
 * TAC (Type Allocation Code) engine - Step 1.
 *
 * Local database first: the Excel dump (tac_full.xlsx) is imported into
 * tac_codes, lookups are served from SQLite, and the Hicelltek API is only an
 * optional last resort (free plan = 100 lookups/month).
 *
 * Everything in this file is offline and synchronous except importWorkbook().
 * The cleaning helpers (normalizeBrand / smartTitleCase / parseSpecs) are pure
 * so the test-suite can pin them to the real spreadsheet's quirks.
 */
import fs from "node:fs";
import ExcelJS from "exceljs";
import unzipper from "unzipper";
import { getDb } from "../db/index.js";
import { badRequest } from "../lib/errors.js";

/* ------------------------------------------------------------------ TAC */

/** digits-only TAC normalisation: 6..7 digits pad to 8, 15-digit IMEI -> first 8. */
export function normalizeTac(input) {
  if (input === undefined || input === null) return null;
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 15) return digits.slice(0, 8);
  if (digits.length === 8) return digits;
  if (digits.length >= 6 && digits.length <= 7) return digits.padStart(8, "0");
  return null;
}

/* ---------------------------------------------------------------- brand */

// Curated spelling for the big brands; the spreadsheet mixes cases
// ('XIAOMI' vs 'Xiaomi', 199 such brands) and has ~11,000 distinct brands
// with a junk long tail ('.FLAIRMICRO', '@PHONE', 'SHENZHEN').
const BRAND_MAP = {
  samsung: "Samsung", apple: "Apple", xiaomi: "Xiaomi", redmi: "Redmi",
  poco: "Poco", oppo: "Oppo", vivo: "Vivo", realme: "Realme",
  oneplus: "OnePlus", motorola: "Motorola", nokia: "Nokia",
  huawei: "Huawei", honor: "Honor", tecno: "Tecno", infinix: "Infinix",
  itel: "Itel", lava: "Lava", micromax: "Micromax", google: "Google",
  sony: "Sony", asus: "Asus", lenovo: "Lenovo", blackberry: "BlackBerry",
};

export function normalizeBrand(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const mapped = BRAND_MAP[s.toLowerCase()];
  if (mapped) return mapped;
  // <=3 letter all-caps acronyms stay all-caps (LG, ZTE, HTC, TCL, BQ, HMD).
  if (s.length <= 3 && s === s.toUpperCase() && /^[A-Za-z0-9+/.-]+$/.test(s)) return s.toUpperCase();
  return smartTitleCase(s);
}

/* -------------------------------------------------------- title casing */

// 3-letter brand acronyms that must stay ALL-CAPS inside names (others like
// 'SIM' are regular words and must become 'Sim').
const ACRONYM_BRANDS = new Set(["HTC", "ZTE", "TCL", "BQ", "HMD"]);
const ORDINAL = /^(\d+)(st|nd|rd|th)$/i;
const digitsOf = (s) => (s.match(/\d/g) || []).length;

/**
 * Title Case each word but keep model-like tokens untouched:
 * tokens starting with a digit, tokens with >=2 digits, <=2 letters + digits
 * (5G, 14S, S22, A54, K10, Y17S, RMX3662, I5) and short all-caps acronyms.
 * 'FLIP7' -> 'Flip7', 'FOLD3' -> 'Fold3', '5TH' -> '5th', 'T-MOBILE' -> 'T-Mobile'.
 */
export function smartTitleCase(input) {
  const s = String(input ?? "").trim();
  if (!s) return "";
  return s
    .split(/\s+/)
    .map((token) => {
      const m = token.match(/^([^A-Za-z0-9]*)([A-Za-z0-9#+/-]+)([^A-Za-z0-9]*)$/);
      if (!m) return token;
      const [, prefix, core, suffix] = m;
      if (!core) return token;
      if (ORDINAL.test(core)) return prefix + core.replace(/(st|nd|rd|th)$/i, (x) => x.toLowerCase()) + suffix;
      if (digitsOf(core) >= 2) return token;                 // 2017, RMX3662, M250ds
      if (/^\d/.test(core)) return token;                    // 14S, 5G, 1610, 4+
      const letters = core.replace(/[^A-Za-z]/g, "");
      if (letters.length <= 2 && digitsOf(core) >= 1) return token; // S22, A54, K10, X3, I5
      if (core === core.toUpperCase() && /^[A-Za-z]+$/.test(core) && (core.length <= 2 || ACRONYM_BRANDS.has(core))) {
        return token; // LG, ZTE, HTC, TCL, BQ, HMD - but 'SIM' becomes 'Sim'
      }
      return (
        prefix +
        core.replace(/[A-Za-z]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) +
        suffix
      );
    })
    .join(" ");
}

/* ------------------------------------------------------------ SPECS */

const stripWords = (t) => String(t ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const notNa = (p) => !!p && p !== "N/A" && p !== "NA";

/**
 * SPECS comes in 3 formats (comma separated):
 *   A) "MARKETING NAME, Maker MODELCODE[, Region/Model note][, Year]"
 *      (the year is often GLUED to the model code: 'Samsung SM-A546E2023')
 *   B) "Single name only" (no model code)
 *   C) "BRAND, NAME" (all of Not_Common: 'APPLE, APPLE IPAD (5TH GEN)')
 * Returns { brand, phoneName, model, extra }.
 */
export function parseSpecs(brandRaw, specsRaw) {
  const brand = normalizeBrand(brandRaw);
  const raw = String(specsRaw ?? "").trim();
  const parts = raw ? raw.split(/\s*,\s*/) : [];

  let nameRaw = "";
  let codePart = null;
  const firstIsBrand = parts.length > 0 && !!brand && parts[0].trim().toLowerCase() === brand.toLowerCase();
  if (firstIsBrand && parts.length > 1) {
    // format C: brand repeated as its own column
    nameRaw = parts[1];
    codePart = null;
  } else {
    nameRaw = parts[0] ?? "";
    codePart = parts[1] ?? null;
  }
  const extra = parts.slice(2).filter(notNa).join(", ");

  // Prepend the normalized brand only when it is not already inside the name.
  const brandInName = !!brand && nameRaw.toLowerCase().includes(brand.toLowerCase());
  const nameCased = smartTitleCase(nameRaw);
  const phoneName = (brandInName ? nameCased : brand ? `${brand} ${nameCased}` : nameCased).trim() || brand || "Unknown";

  // ---- model code ----
  let model = "";
  const code = codePart && notNa(codePart.trim()) ? codePart.trim() : null;
  if (code) {
    let cleaned = code;
    // strip a glued year: trailing 4-digit 2005..2027 attached to a letter/digit,
    // only when at least 3 characters would remain ('V2033'/'CPH1921' are NOT years).
    const ym = cleaned.match(/^(.*[A-Za-z0-9])((?:200[5-9]|201\d|202[0-7]))$/);
    if (ym && ym[1].length >= 3) cleaned = ym[1];

    const tokens = cleaned.split(/\s+/);
    const candidate = tokens[tokens.length - 1] || "";
    const codeWords = stripWords(cleaned);
    const nameWords = stripWords(nameRaw);
    const sameWords =
      codeWords === nameWords ||
      (tokens.length > 1 && stripWords(tokens.slice(1).join(" ")) === stripWords(nameRaw.replace(/^\s*\S+\s*/, "")));

    if (candidate && digitsOf(candidate) >= 1 && !sameWords) {
      model = candidate;
    }
  }

  if (!model) {
    // fallback: phone name without the brand prefix (the model field is required)
    let base = phoneName;
    if (brand && base.toLowerCase().startsWith(brand.toLowerCase() + " ")) base = base.slice(brand.length).trim();
    model = base || phoneName || "Unknown";
  }

  return { brand, phoneName, model, extra };
}

/* ------------------------------------------------------------- lookup */

function rowToApi(row) {
  if (!row) return { found: false };
  return {
    found: true,
    tac: row.tac,
    brand: row.brand,
    phoneName: row.phone_name,
    model: row.model,
    specs: row.specs || "",
    source: row.source,
  };
}

export function lookupTac(value) {
  const tac = normalizeTac(value);
  if (!tac) return { found: false, error: { code: "INVALID_TAC", message: "Enter an 8-digit TAC (or 15-digit IMEI)." } };
  const row = getDb().prepare("SELECT * FROM tac_codes WHERE tac = ?").get(tac);
  return row ? rowToApi(row) : { found: false, tac };
}

export function getStats() {
  const db = getDb();
  const total = db.prepare("SELECT COUNT(*) AS n FROM tac_codes").get().n;
  const bySource = {};
  for (const r of db.prepare("SELECT source, COUNT(*) AS n FROM tac_codes GROUP BY source").all()) {
    bySource[r.source] = r.n;
  }
  const misses = db.prepare("SELECT COUNT(*) AS n FROM tac_api_misses").get().n;
  return { total, bySource, apiMisses: misses };
}

/** Auto-learning: remember what the shop actually sold under this TAC. */
export function learnTac({ tac, imei, brand, phoneName, model, specs }) {
  const code = normalizeTac(tac || imei);
  if (!code) throw badRequest("A TAC (8 digits) or IMEI (15 digits) is required.");
  if (!brand || !phoneName || !model) throw badRequest("brand, phoneName and model are required.");
  getDb()
    .prepare(
      `INSERT INTO tac_codes (tac, brand, phone_name, model, specs, source)
       VALUES (?, ?, ?, ?, ?, 'learned')
       ON CONFLICT(tac) DO UPDATE SET
         brand = excluded.brand, phone_name = excluded.phone_name, model = excluded.model,
         specs = excluded.specs, updated_at = datetime('now')
       WHERE tac_codes.source <> 'manual'`
    )
    .run(code, String(brand), String(phoneName), String(model), specs ? String(specs) : null);
  return lookupTac(code);
}

/** Save an online (Hicelltek) answer. Never clobbers excel/manual/learned rows. */
export function storeApiResult({ tac, brand, phoneName, model, specs }) {
  const code = normalizeTac(tac);
  if (!code) throw badRequest("A TAC (8 digits) or IMEI (15 digits) is required.");
  if (!brand || !phoneName || !model) throw badRequest("brand, phoneName and model are required.");
  getDb()
    .prepare(
      `INSERT INTO tac_codes (tac, brand, phone_name, model, specs, source)
       VALUES (?, ?, ?, ?, ?, 'api')
       ON CONFLICT(tac) DO UPDATE SET
         brand = excluded.brand, phone_name = excluded.phone_name, model = excluded.model,
         specs = excluded.specs, source = 'api', updated_at = datetime('now')
       WHERE tac_codes.source = 'api'`
    )
    .run(code, String(brand), String(phoneName), String(model), specs ? String(specs) : null);
  return lookupTac(code);
}

/* ------------------------------------------------------------- import */

const SHEET_ORDER = ["Common", "Not_Common", "ALL"]; // first occurrence of a TAC wins

/**
 * exceljs 4.4 streams worksheets BEFORE xl/workbook.xml is reached when the
 * writer put workbook.xml last (both Excel and exceljs's own writer do), which
 * crashes the reader on `this.model.sheets` and loses the sheet names. Reading
 * the tiny workbook.xml up-front and seeding the reader's model fixes both.
 */
async function preReadSheetModel(filePath) {
  try {
    const zip = await unzipper.Open.file(filePath);
    const entry = zip.files.find((f) => f.path === "xl/workbook.xml");
    if (!entry) return null;
    const xml = (await entry.buffer()).toString("utf8");
    const sheets = [];
    for (const tag of xml.match(/<sheet\b[^>]*\/?\s*>/g) || []) {
      const name = (tag.match(/\bname="([^"]*)"/) || [])[1];
      const rid =
        (tag.match(/\br:id="([^"]*)"/) || [])[1] ||
        (tag.match(/\b\w+:id="([^"]*)"/) || [])[1];
      if (name !== undefined) sheets.push({ id: sheets.length + 1, name, rId: rid });
    }
    return sheets.length ? { sheets } : null;
  } catch {
    return null; // not a readable zip - let the streaming reader report the error
  }
}

function readTacCell(cell) {
  if (typeof cell === "number" && Number.isFinite(cell)) return String(Math.trunc(cell));
  if (typeof cell === "bigint") return String(cell);
  return String(cell ?? "").trim();
}

/**
 * Import a tac_full.xlsx style workbook with the STREAMING reader.
 * Real-data facts baked in:
 *  - 3 sheets; ALL = Common + Not_Common (first occurrence wins, so the order
 *    Common -> Not_Common -> ALL keeps the cleanest data).
 *  - Columns are always A=Brand, B=TAC, C=SPECS; only the first 3 cells read.
 *  - Not_Common has NO header row -> row 1 is a header only if its TAC cell
 *    literally says "TAC".
 *  - TAC cells are Excel numbers: leading zeros are lost (6,621 of them) ->
 *    left-pad to 8. Accept 6..8 digits only.
 *  - Skip: blank/non-numeric TAC (section dividers), TAC = 0, and any row whose
 *    SPECS contains "TEST IMEI" (~407). Duplicates inside a sheet: first wins.
 */
export async function importWorkbook(filePath, { overwrite = false } = {}) {
  if (!fs.existsSync(filePath)) throw badRequest("Excel file not found.");
  const started = Date.now();

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
  });

  const seededModel = await preReadSheetModel(filePath);
  if (seededModel) reader.model = seededModel;

  // Pass 1: collect the first three cells per sheet (memory-light rows).
  const rowsBySheet = new Map();
  let sheetNo = 0;
  for await (const sheet of reader) {
    sheetNo++;
    const name = String(sheet.name || `Sheet${sheetNo}`);
    const rows = [];
    let first = true;
    for await (const row of sheet) {
      const v = row.values || [];
      const tacCell = v[2];
      const isHeader = first && String(tacCell ?? "").trim().toLowerCase() === "tac";
      rows.push({ brand: v[1], tac: tacCell, specs: v[3], isHeader });
      first = false;
    }
    rowsBySheet.set(name, rows);
  }

  // Pass 2: process sheets in canonical order inside chunked transactions.
  const names = [
    ...SHEET_ORDER.filter((n) => rowsBySheet.has(n)),
    ...[...rowsBySheet.keys()].filter((n) => !SHEET_ORDER.includes(n)),
  ];

  const db = getDb();
  const exists = db.prepare("SELECT source FROM tac_codes WHERE tac = ?");
  const insert = db.prepare(
    `INSERT INTO tac_codes (tac, brand, phone_name, model, specs, specs_raw, source)
     VALUES (?, ?, ?, ?, ?, ?, 'excel')
     ON CONFLICT(tac) DO UPDATE SET
       brand = excluded.brand, phone_name = excluded.phone_name, model = excluded.model,
       specs = excluded.specs, specs_raw = excluded.specs_raw, updated_at = datetime('now')
     WHERE tac_codes.source = 'excel'`
  );

  const report = [];
  let added = 0;
  let updated = 0;
  let duplicates = 0;

  for (const name of names) {
    const rows = rowsBySheet.get(name) || [];
    const stats = {
      name,
      dataRows: 0,
      added: 0,
      duplicates: 0,
      updated: 0,
      skipped: { blank: 0, zero: 0, testImei: 0, badLength: 0 },
    };
    const seen = new Set();
    let buffer = [];

    const flush = () => {
      if (!buffer.length) return;
      const ops = buffer;
      buffer = [];
      db.transaction(() => {
        for (const op of ops) {
          const existing = exists.get(op.tac);
          if (!existing) {
            insert.run(op.tac, op.brand, op.phoneName, op.model, op.specs, op.specsRaw);
            stats.added++;
            added++;
          } else if (existing.source === "excel" && overwrite) {
            insert.run(op.tac, op.brand, op.phoneName, op.model, op.specs, op.specsRaw);
            stats.updated++;
            updated++;
          } else {
            stats.duplicates++;
            duplicates++;
          }
        }
      })();
    };

    for (const row of rows) {
      if (row.isHeader) continue;
      stats.dataRows++;

      const specsText = row.specs === undefined || row.specs === null ? "" : String(row.specs).trim();
      if (specsText.toUpperCase().includes("TEST IMEI")) {
        stats.skipped.testImei++;
        continue;
      }

      const tacStr = readTacCell(row.tac);
      if (!/^\d+$/.test(tacStr)) {
        stats.skipped.blank++;
        continue;
      }
      if (/^0+$/.test(tacStr)) {
        stats.skipped.zero++;
        continue;
      }
      if (tacStr.length < 6 || tacStr.length > 8) {
        stats.skipped.badLength++;
        continue;
      }
      const tac = tacStr.padStart(8, "0");
      if (seen.has(tac)) {
        stats.duplicates++;
        duplicates++;
        continue;
      }
      seen.add(tac);

      const { brand, phoneName, model, extra } = parseSpecs(row.brand, specsText);
      buffer.push({
        tac,
        brand,
        phoneName,
        model,
        specs: extra || null,
        specsRaw: specsText || null,
      });
      if (buffer.length >= 5000) flush();
    }
    flush();
    report.push(stats);
  }

  const total = db.prepare("SELECT COUNT(*) AS n FROM tac_codes").get().n;
  return {
    sheets: report,
    total: added + updated,
    databaseTotal: total,
    duplicates,
    updated,
    durationMs: Date.now() - started,
  };
}

/* ------------------------------------------------------------- export */

/**
 * PhoneZone_TAC_<date>.xlsx - ONE sheet "ALL", header Brand/TAC/SPECS/Source,
 * TAC written as TEXT so leading zeros survive, re-importable by importWorkbook
 * (the extra Source column is ignored on import).
 */
export async function exportDatabase(outPath) {
  const db = getDb();
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: outPath, useStyles: true });
  const ws = wb.addWorksheet("ALL");
  ws.addRow(["Brand", "TAC", "SPECS", "Source"]);

  const stmt = db.prepare(
    "SELECT brand, tac, phone_name, model, specs, specs_raw, source FROM tac_codes ORDER BY brand, tac"
  );
  let i = 0;
  for (const r of stmt.iterate()) {
    const specs =
      r.specs_raw ||
      `${r.phone_name}, ${r.brand} ${r.model}${r.specs ? `, ${r.specs}` : ""}`;
    const row = ws.addRow([r.brand, r.tac, specs, r.source]);
    row.getCell(2).numFmt = "@";
    if (++i % 1000 === 0) ws.commit();
  }
  ws.commit();
  await wb.commit();
  return outPath;
}
