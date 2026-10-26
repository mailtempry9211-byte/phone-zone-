#!/usr/bin/env node
/**
 * PhoneZone MAKE-ZIP - builds a SAFE, shareable source zip.
 *
 * Produces `PhoneZone_clean_<YYYYMMDD-HHMM>.zip` in the project root:
 *   * only source + config + docs (no node_modules, no build output);
 *   * NEVER any real business data (`data/`, `data11/`, `*.db`, `.env`,
 *     `*.tar.gz`, backups, logs);
 *   * a safety scan runs BEFORE the zip is written and AGAIN on the finished
 *     archive. If it finds anything that must not leave the machine, the zip is
 *     deleted and the run fails loudly.
 *   * `ZIP_MANIFEST.txt` inside the zip lists every file with its size and
 *     sha256, plus the totals, so a reviewer can verify what they received.
 *
 * Run it by double-clicking MAKE-ZIP.bat.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/* ------------------------------------------------------------------ */
/* what goes in                                                        */
/* ------------------------------------------------------------------ */

/** Whole directories that are part of the deliverable. */
const INCLUDE_DIRS = ["src", "public", "backend", "database", "config", "scripts", "docs", "supabase"];
/** Directories that are included only when they exist (created in later stages). */
const INCLUDE_IF_PRESENT = ["electron"];

/** Root files always included when present. */
const INCLUDE_ROOT_FILES = [
  "index.html",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "tailwind.config.ts",
  "postcss.config.js",
  "eslint.config.js",
  "components.json",
  "icon.ico",
  ".gitignore",
  ".env.example",
  "VERIFY_OUTPUT.txt",
  "REPORT.md",
  "README.md",
  "FIXES.md",
  "AUDIT_REPORT.md",
  "PhoneZone_Audit_and_Plan.md",
  "PhoneZone_MASTER_PROMPT.md",
];

/** Root-file patterns that are always included when present. */
const INCLUDE_ROOT_PATTERNS = [/^tsconfig.*\.json$/, /\.bat$/i, /\.ps1$/i, /\.md$/i];

/** Directories that are never walked. */
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  ".kilo",
  ".cline",
  ".client",
  ".vscode",
  ".idea",
  ".lovable",
  ".freebuff",
  "data",
  "data11",
  "dist",
  "dist-electron",
  "release",
  "scratch",
  "ppppppppp",
  "_backup_stage1_20261016-1242",
]);

/** Filenames / extensions that must never ship. */
const EXCLUDE_FILE = [
  /^\.env$/i,
  /\.db$/i,
  /\.db-wal$/i,
  /\.db-shm$/i,
  /\.sqlite$/i,
  /\.log$/i,
  /\.tar\.gz$/i,
  /\.zip$/i,
  /^ngrok-/i,
  /^tmp-/i,
  /^\.tmp-/i,
  /^err\.txt$/i,
  /^out\.txt$/i,
  /^back-.*\.png$/i,
  /^vite-out\.log$/i,
  /^_backup_/i,
];

/** Paths (inside the zip) that make the whole run fail. */
const FATAL_PATH = [/^\.env$/i, /\.db($|-)/i, /^data\//i, /^data11\//i, /node_modules\//i, /\.tar\.gz$/i];

const isExcludedDir = (name) => EXCLUDE_DIRS.has(name) || name.toLowerCase().startsWith("_backup_");
const isExcludedFile = (name) => EXCLUDE_FILE.some((re) => re.test(name));
const isBinary = (name) => /\.(png|jpg|jpeg|gif|ico|webp|woff2?|ttf|eot|wasm|pdf|gz|zip|mp4|traineddata)$/i.test(name);

/* ------------------------------------------------------------------ */
/* collect files                                                       */
/* ------------------------------------------------------------------ */

const entries = []; // { zipPath, absPath }

function walkDir(absDir, zipDir, depth) {
  const name = path.basename(absDir);
  if (depth > 0 && isExcludedDir(name)) return;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name);
    const rel = `${zipDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (isExcludedDir(entry.name)) continue;
      walkDir(abs, rel, depth + 1);
    } else if (entry.isFile()) {
      if (isExcludedFile(entry.name)) continue;
      // Root-level *.traineddata is a leftover debug copy; the OCR copy that
      // ships lives under public/ocr and is included above.
      if (depth === 0 && /\.traineddata$/i.test(entry.name)) continue;
      if (entry.name.endsWith(".map")) continue; // source maps never ship
      entries.push({ zipPath: rel, absPath: abs });
    }
  }
}

for (const dir of [...INCLUDE_DIRS, ...INCLUDE_IF_PRESENT]) {
  const abs = path.join(ROOT, dir);
  if (fs.existsSync(abs)) walkDir(abs, dir, 0);
}

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (isExcludedFile(entry.name)) continue;
  // The root *.traineddata is a leftover debug copy; public/ocr ships the real one.
  if (/\.traineddata$/i.test(entry.name)) continue;
  const wanted =
    INCLUDE_ROOT_FILES.includes(entry.name) || INCLUDE_ROOT_PATTERNS.some((re) => re.test(entry.name));
  if (!wanted) continue;
  entries.push({ zipPath: entry.name, absPath: path.join(ROOT, entry.name) });
}

/* ------------------------------------------------------------------ */
/* safety scan                                                         */
/* ------------------------------------------------------------------ */

/**
 * A JWT-looking string. Supabase publishable ("anon") keys are JWTs that the app
 * ships in the browser bundle by design - they are not secrets, so they are
 * reported as a WARNING. A privileged (admin) key IS a secret and aborts the run.
 *
 * The pattern is assembled from pieces so this file does not trip its own scan.
 */
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}/g;
const PRIVILEGED_KEY_RE = new RegExp(["SUPABASE", "SERVICE", "ROLE"].join("_") + "|" + ["service", "role"].join("_"), "i");

function jwtRole(token) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json).role || null;
  } catch {
    return null;
  }
}

function scanFile(zipPath, buffer, problems, warnings) {
  const normalized = zipPath.replace(/\\/g, "/");
  for (const re of FATAL_PATH) {
    if (re.test(normalized)) problems.push(`forbidden path in archive: ${normalized}`);
  }
  if (isBinary(normalized) || buffer.includes(0)) return;
  const text = buffer.toString("utf8");
  if (PRIVILEGED_KEY_RE.test(text)) {
    problems.push(`service-role reference found in ${normalized}`);
  }
  for (const token of text.match(JWT_RE) || []) {
    const role = jwtRole(token);
    if (role === "anon" || role === "authenticated") {
      warnings.push(`public "${role}" key (by design, not a secret) in ${normalized}`);
    } else {
      problems.push(`non-public JWT (role: ${role || "unknown"}) in ${normalized}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* build                                                               */
/* ------------------------------------------------------------------ */

const problems = [];
const warnings = [];

// Scan the source tree BEFORE writing anything.
for (const entry of entries) {
  const buffer = fs.readFileSync(entry.absPath);
  entry.buffer = buffer;
  scanFile(entry.zipPath, buffer, problems, warnings);
}

const uniqueProblems = [...new Set(problems)];
const uniqueWarnings = [...new Set(warnings)];

if (uniqueProblems.length) {
  console.error("\n  ZIP REFUSED - this project was NOT packaged.\n");
  console.error("  The safety scan found data or secrets that must not leave this computer:");
  for (const p of uniqueProblems) console.error(`    - ${p}`);
  console.error("\n  Nothing was written. Fix the listed items and run MAKE-ZIP.bat again.\n");
  process.exit(1);
}

const manifestLines = [];
let totalBytes = 0;
for (const entry of entries.sort((a, b) => a.zipPath.localeCompare(b.zipPath))) {
  const sha = crypto.createHash("sha256").update(entry.buffer).digest("hex");
  totalBytes += entry.buffer.length;
  manifestLines.push(`${sha}  ${String(entry.buffer.length).padStart(10)}  ${entry.zipPath}`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16).replace("T", "-");
const zipName = `PhoneZone_clean_${stamp}.zip`;
const zipPath = path.join(ROOT, zipName);

const zip = new JSZip();
for (const entry of entries) zip.file(entry.zipPath, entry.buffer);

const manifest = [
  "PhoneZone clean package - ZIP MANIFEST",
  `Created : ${new Date().toISOString()}`,
  `Node    : ${process.version}  Platform: ${process.platform} ${process.arch}`,
  "",
  `Files   : ${entries.length}`,
  `Bytes   : ${totalBytes}`,
  "",
  "EXCLUDED ON PURPOSE: node_modules/, data/, data11/, *.db*, .env, *.tar.gz,",
  "logs, backups (_backup_*), build output (dist/, release/), scratch/, *.map",
  "",
  uniqueWarnings.length
    ? `WARNINGS (review these - they are public keys, not secrets):\n${uniqueWarnings.map((w) => `  - ${w}`).join("\n")}`
    : "WARNINGS: none",
  "",
  "sha256                                                            bytes  path",
  "-".repeat(120),
  ...manifestLines,
  "",
].join("\n");

zip.file("ZIP_MANIFEST.txt", manifest);

const buffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
});

// Scan the FINISHED archive too (belt and braces: catches anything added by the
// manifest step and proves the on-disk zip is clean).
const verifyProblems = [];
const verifyWarnings = [];
const reread = await JSZip.loadAsync(buffer);
for (const [name, file] of Object.entries(reread.files)) {
  if (file.dir) continue;
  const content = Buffer.from(await file.async("nodebuffer"));
  scanFile(name, content, verifyProblems, verifyWarnings);
}
const finalProblems = [...new Set(verifyProblems)];
if (finalProblems.length) {
  console.error("\n  ZIP REFUSED - the finished archive failed its own safety scan:\n");
  for (const p of finalProblems) console.error(`    - ${p}`);
  console.error("\n  No zip file was written.\n");
  process.exit(1);
}

fs.writeFileSync(zipPath, buffer);

console.log("");
console.log("  Clean zip created:");
console.log(`    ${zipPath}`);
console.log(`    size      : ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`    files     : ${entries.length}`);
console.log(`    manifest  : ZIP_MANIFEST.txt inside the zip (${entries.length} entries)`);
if (uniqueWarnings.length) {
  console.log("");
  console.log("  WARNINGS (public keys only, listed in the manifest as well):");
  for (const w of uniqueWarnings) console.log(`    - ${w}`);
}
console.log("");
