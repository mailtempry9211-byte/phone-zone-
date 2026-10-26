/**
 * copy-ocr-assets.mjs - make Aadhaar OCR work fully offline.
 *
 * tesseract.js normally pulls its worker, wasm core and language data from a CDN.
 * PhoneZone must run with no internet, so this script copies everything that is
 * already inside node_modules into public/ocr/ (Vite serves public/ as /) and
 * downloads eng.traineddata.gz ONCE (the only file npm does not ship).
 *
 * Run:  node scripts/copy-ocr-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "ocr");
fs.mkdirSync(out, { recursive: true });

const copy = (from, to = path.basename(from)) => {
  const src = path.join(root, from);
  if (!fs.existsSync(src)) {
    console.warn(`  skip (missing) ${from}`);
    return false;
  }
  fs.copyFileSync(src, path.join(out, to));
  console.log(`  copied ${from} -> public/ocr/${to}`);
  return true;
};

console.log("Copying tesseract worker + core...");
copy("node_modules/tesseract.js/dist/worker.min.js");

// pdf.js worker - lets the Aadhaar scan buttons read e-Aadhaar PDFs offline
// (the printed PNG screenshots often have too small a QR to decode; the PDF
// renders it at full resolution).
copy("node_modules/pdfjs-dist/build/pdf.worker.min.mjs");

// Standard font data (non-embedded fonts in e-Aadhaar PDFs) + cmaps.
const fontsDir = path.join(root, "node_modules", "pdfjs-dist", "standard_fonts");
if (fs.existsSync(fontsDir)) {
  const fontOut = path.join(out, "standard_fonts");
  fs.mkdirSync(fontOut, { recursive: true });
  for (const f of fs.readdirSync(fontsDir)) fs.copyFileSync(path.join(fontsDir, f), path.join(fontOut, f));
  console.log(`  copied standard_fonts (${fs.readdirSync(fontOut).length} files)`);
}
const cmapsDir = path.join(root, "node_modules", "pdfjs-dist", "cmaps");
if (fs.existsSync(cmapsDir)) {
  const cmapOut = path.join(out, "cmaps");
  fs.mkdirSync(cmapOut, { recursive: true });
  for (const f of fs.readdirSync(cmapsDir)) fs.copyFileSync(path.join(cmapsDir, f), path.join(cmapOut, f));
  console.log(`  copied cmaps (${fs.readdirSync(cmapOut).length} files)`);
}

// The core files the browser worker may pick (relaxed-simd -> simd -> plain).
const coreDir = "node_modules/tesseract.js-core";
for (const f of fs.existsSync(path.join(root, coreDir)) ? fs.readdirSync(path.join(root, coreDir)) : []) {
  if (/^tesseract-core.*\.(wasm\.js|wasm|js)$/.test(f)) copy(path.join(coreDir, f));
}

// Language data - npm does not ship it; fetch once, keep forever.
const langFile = path.join(out, "eng.traineddata.gz");
if (fs.existsSync(langFile) && fs.statSync(langFile).size > 100_000) {
  console.log("  eng.traineddata.gz already present");
} else {
  const url = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz";
  console.log(`  downloading ${url} ...`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(langFile, Buffer.from(await res.arrayBuffer()));
    console.log(`  saved eng.traineddata.gz (${fs.statSync(langFile).size} bytes)`);
  } catch (err) {
    console.warn(`  WARNING: could not download language data (${err.message}).`);
    console.warn("  Aadhaar OCR will fall back to the CDN on first use, or re-run this script when online.");
  }
}

console.log("Done - OCR assets live in public/ocr/");
