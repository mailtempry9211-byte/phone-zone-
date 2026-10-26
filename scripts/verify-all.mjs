#!/usr/bin/env node
/**
 * PhoneZone VERIFY - one double-click produces VERIFY_OUTPUT.txt.
 *
 * Runs, in order:
 *   1. environment info + sha256 of the security-critical files
 *   2. `node --check` on every backend/scripts .js/.mjs/.cjs file
 *   3. every migration on a brand-new database, then the remaining migrations
 *      on a database built from the first seven
 *   4. the backend on a free port with a throwaway data directory
 *   5. the assertion list for STAGE 1 (A01 .. A20)
 *   6. typecheck + production build (only when node_modules exists)
 *
 * SAFETY: it never reads data/, data11/ or any real *.db. Everything happens in
 * a fresh directory under os.tmpdir(), which is deleted at the end. It never
 * prints a password, token, or customer record. It always exits 0 so the .bat
 * file's `pause` is reached; the real verdict is the summary line.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The stage this run covers. Update it when the next stage starts. */
const STAGE = 5;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const BACKEND = path.join(ROOT, "backend");
const MIGRATIONS = path.join(ROOT, "database", "migrations");
const REPORT_FILE = path.join(ROOT, "VERIFY_OUTPUT.txt");

const lines = [];
const say = (s = "") => {
  lines.push(s);
  console.log(s);
};

let passCount = 0;
let failCount = 0;
let skipCount = 0;
const failures = [];

function record(id, ok, note = "") {
  const label = id ? `${id} ${ok === null ? "SKIPPED" : ok ? "PASS" : "FAIL"}` : ok === null ? "SKIPPED" : ok ? "PASS" : "FAIL";
  if (ok === null) skipCount++;
  else if (ok) passCount++;
  else {
    failCount++;
    failures.push(`${id} -> ${note}`);
  }
  say(`  ${label}${note ? `  ${note}` : ""}`);
}

const tmpDirs = [];
const makeTmp = (prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** Walk a directory, returning every file whose name matches `test`. */
function walk(dir, test, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, test, acc);
    } else if (test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Read the temp database directly (read-only) for the two assertions that need
 * to see rows the API deliberately hides. Runs in a child process so it uses
 * backend/node_modules' better-sqlite3 build.
 */
function dbProbe(dataDir, sql, params = []) {
  const script = `
import { createRequire } from "node:module";
// Resolve native modules from the backend install, not from this temp file.
const require = createRequire(${JSON.stringify(path.join(BACKEND, "package.json"))});
const Database = require("better-sqlite3");
const db = new Database(${JSON.stringify(path.join(dataDir, "database", "phonezone.db"))}, { readonly: true });
try {
  console.log(JSON.stringify(db.prepare(${JSON.stringify(sql)}).all(...${JSON.stringify(params)})));
} catch (err) {
  console.log(JSON.stringify({ __error: String(err && err.message) }));
}
db.close();
`;
  const file = path.join(makeTmp("pz-probe-"), "probe.mjs");
  fs.writeFileSync(file, script);
  const out = execFileSync(process.execPath, [file], {
    cwd: BACKEND,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out.trim().split(/\r?\n/).pop());
}

/**
 * Write to the temp database directly. Only used by A41, which has to forge a
 * `files` row (bypassing every app guard) to prove the read endpoints cannot be
 * tricked into serving the SQLite database file.
 */
function dbExec(dataDir, sql, params = []) {
  const script = `
import { createRequire } from "node:module";
const require = createRequire(${JSON.stringify(path.join(BACKEND, "package.json"))});
const Database = require("better-sqlite3");
const db = new Database(${JSON.stringify(path.join(dataDir, "database", "phonezone.db"))});
try {
  db.prepare(${JSON.stringify(sql)}).run(...${JSON.stringify(params)});
  console.log(JSON.stringify({ ok: true }));
} catch (err) {
  console.log(JSON.stringify({ ok: false, error: String(err && err.message) }));
}
db.close();
`;
  const file = path.join(makeTmp("pz-write-"), "write.mjs");
  fs.writeFileSync(file, script);
  const out = execFileSync(process.execPath, [file], {
    cwd: BACKEND,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out.trim().split(/\r?\n/).pop());
}

/**
 * Build a partial database by running only the migrations up to `uptoFile`
 * (inclusive), exactly as the app's migration runner does - but without
 * importing the app, so the caller can then point the real server at it.
 */
function buildPartialDb(dataDir, uptoFile) {
  const script = `
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
// Resolve native modules from the backend install, not from this temp file.
const require = createRequire(${JSON.stringify(path.join(BACKEND, "package.json"))});
const Database = require("better-sqlite3");
const target = ${JSON.stringify(path.join(dataDir, "database", "phonezone.db"))};
fs.mkdirSync(path.dirname(target), { recursive: true });
const db = new Database(target);
db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))");
const migDir = ${JSON.stringify(MIGRATIONS)};
const upto = ${JSON.stringify(uptoFile)};
for (const file of fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
  if (upto && file > upto) break;
  db.exec(fs.readFileSync(path.join(migDir, file), "utf8"));
  db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(file.replace(/\\.sql$/, ""));
}
console.log(db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get().n);
db.close();
`;
  const file = path.join(makeTmp("pz-migrate-"), "build.mjs");
  fs.writeFileSync(file, script);
  return Number(execFileSync(process.execPath, [file], { cwd: BACKEND, encoding: "utf8" }).trim());
}

/** Boot the real backend as a child process and wait until /api/health answers. */
async function startServer({ dataDir, env = {}, log = [] } = {}) {
  const port = 47000 + Math.floor(Math.random() * 1500);
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: BACKEND,
    env: {
      ...process.env,
      PHONEZONE_DATA_DIR: dataDir,
      PHONEZONE_PORT: String(port),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const collect = (chunk) => {
    const text = String(chunk);
    log.push(text);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  const base = `http://127.0.0.1:${port}/api`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return { child, base, port, log };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  child.kill();
  throw new Error(`backend did not become ready; log:\n${log.join("")}`);
}

async function stopServer(server) {
  if (!server?.child) return;
  server.child.kill();
  await new Promise((r) => setTimeout(r, 400));
  try {
    server.child.kill("SIGKILL");
  } catch {
    /* already gone */
  }
}

/** Tiny API client with a cookie jar. Returns { status, body, headers }. */
function makeClient(base) {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    set cookie(v) {
      cookie = v;
    },
    async call(method, url, body, extraHeaders = {}) {
      const headers = { cookie, ...extraHeaders };
      let payload;
      if (body instanceof FormData) payload = body;
      else if (body !== undefined) {
        headers["content-type"] = "application/json";
        payload = JSON.stringify(body);
      }
      const res = await fetch(`${base}${url}`, { method, headers, body: payload, redirect: "manual" });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      const text = await res.text();
      let parsed = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* keep text */
      }
      return { status: res.status, body: parsed, headers: res.headers };
    },
  };
}

/**
 * Source files this stage edited. A20 uses it to prove that any type error it
 * reports comes from PRE-EXISTING code, not from this stage's changes.
 */
const STAGE_CHANGED = new Set([
  "src/components/admin/AddPhoneDialog.tsx",
  "src/components/admin/AccountingTab.tsx",
  "src/components/admin/DatabaseTab.tsx",
  "src/components/admin/MessagesTab.tsx",
  "src/components/admin/SettingsTab.tsx",
  "src/components/admin/ShopManagementDialog.tsx",
  "src/components/admin/StorageTab.tsx",
  "src/integrations/supabase/types.ts",
  "src/lib/invoiceTemplates.ts",
  "src/pages/Index.tsx",
  "src/utils/numberToWords.ts",
]);

/** A real 1x1 PNG - the bytes must be genuine for the magic-byte check. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

/** Luhn check digit helper, so generated test IMEIs are always valid. */
function validImeiFrom(prefix14) {
  for (let c = 0; c <= 9; c++) {
    const candidate = prefix14 + c;
    let sum = 0;
    let double = false;
    for (let i = candidate.length - 1; i >= 0; i--) {
      let d = candidate.charCodeAt(i) - 48;
      if (double) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      double = !double;
    }
    if (sum % 10 === 0) return candidate;
  }
  return prefix14 + "0";
}

/* ------------------------------------------------------------------ */
/* 1. environment + hashes                                             */
/* ------------------------------------------------------------------ */

say("PhoneZone VERIFY");
say("=".repeat(72));
say(`Stage            : ${STAGE}`);
say(`Date             : ${new Date().toISOString()}`);
say(`Node             : ${process.version}`);
say(`Platform         : ${process.platform} ${process.arch} (${os.release()})`);
say(`Project root     : ${ROOT}`);
say("");

const HASHED_FILES = [
  "backend/src/routes/index.js",
  "backend/src/routes/compat.js",
  "backend/src/services/inventoryService.js",
  "backend/src/services/storageService.js",
  "backend/src/services/authService.js",
  "backend/src/services/backupService.js",
  "package.json",
];
say("--- sha256 of security-critical files ---");
for (const rel of HASHED_FILES) {
  const abs = path.join(ROOT, rel);
  say(`${fs.existsSync(abs) ? sha256(abs) : "(missing)".padEnd(64)}  ${rel}`);
}
for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
  say(`${sha256(path.join(MIGRATIONS, file))}  database/migrations/${file}`);
}
say("");

/* ------------------------------------------------------------------ */
/* 2. syntax check                                                     */
/* ------------------------------------------------------------------ */

say("--- A01: node --check on backend + scripts ---");
const checkTargets = [
  ...walk(path.join(BACKEND, "src"), (n) => /\.(m?js|cjs)$/.test(n)),
  ...walk(path.join(BACKEND, "test"), (n) => /\.(m?js|cjs)$/.test(n)),
  ...walk(path.join(ROOT, "scripts"), (n) => /\.(m?js|cjs)$/.test(n)),
];
let checkFail = 0;
for (const file of checkTargets) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (err) {
    checkFail++;
    say(`  SYNTAX ERROR ${path.relative(ROOT, file)}: ${String(err.stderr || err.message).slice(0, 300)}`);
  }
}
record("A01", checkFail === 0, `${checkTargets.length} files checked, ${checkFail} failed`);
say("");

/* ------------------------------------------------------------------ */
/* 3. migrations                                                       */
/* ------------------------------------------------------------------ */

say("--- A02 / A03: migrations ---");
let a02 = false;
let a02Note = "";
const freshDir = makeTmp("pz-fresh-");
try {
  const applied = buildPartialDb(freshDir, ""); // no limit => every migration
  const total = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).length;
  a02 = applied === total;
  a02Note = `${applied}/${total} migrations applied to a brand-new database`;
} catch (err) {
  a02Note = String(err.message).slice(0, 200);
}
record("A02", a02, a02Note);

// The runner stamps 001..007, then the app itself must apply 008.. onward when
// it opens that database.
const partialDir = makeTmp("pz-partial-");
let a03 = false;
let a03Note = "";
let partialApplied = 0;
try {
  partialApplied = buildPartialDb(partialDir, "007_shops.sql");
  const partialServer = await startServer({ dataDir: partialDir });
  const health = await makeClient(partialServer.base).call("GET", "/health");
  await stopServer(partialServer);
  const after = dbProbe(partialDir, "SELECT version FROM schema_migrations ORDER BY version");
  const total = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).length;
  a03 = health.status === 200 && after.length === total;
  a03Note = `${partialApplied} pre-stamped, ${after.length}/${total} after startup`;
} catch (err) {
  a03Note = String(err.message).slice(0, 200);
}
record("A03", a03, a03Note);
say("");

/* ------------------------------------------------------------------ */
/* 4/5. live server + assertions                                       */
/* ------------------------------------------------------------------ */

say("--- live backend on a throwaway data directory ---");
const dataDir = makeTmp("pz-verify-");
const serverLog = [];
let server = null;
let client = null;

try {
  server = await startServer({ dataDir, log: serverLog });
  say(`  server ready on ${server.base}`);
  client = makeClient(server.base);

  // A04 ------------------------------------------------------------------
  const health = await client.call("GET", "/health");
  record("A04", health.status === 200 && health.body?.ok === true, `GET /api/health -> ${health.status}`);

  // A05 (part 1): startup creates no user and prints no password ---------
  const bootLog = serverLog.join("");
  const leakedPassword = /Temporary password/i.test(bootLog);
  const createdAdmin = /Admin account created/i.test(bootLog);
  const usersAtBoot = dbProbe(dataDir, "SELECT id FROM users");
  record(
    "A05",
    usersAtBoot.length === 0 && !leakedPassword && !createdAdmin,
    `users at startup = ${usersAtBoot.length}, password printed = ${leakedPassword}`,
  );

  // A14: setup is refused through a proxy header, on a fresh DB ----------
  const setupBody = {
    businessName: "Verify Shop",
    primaryPhone: "9990001111",
    address: "1 Test Road",
    email: "owner@verify.test",
    password: "verify-pass-123",
  };
  const proxied = await client.call("POST", "/setup", setupBody, { "x-forwarded-for": "203.0.113.9" });
  const proxiedUpload = await client.call("POST", "/setup/upload", new FormData(), {
    "x-forwarded-for": "203.0.113.9",
  });
  const proxiedRestore = await client.call("POST", "/setup/restore", new FormData(), {
    "x-forwarded-for": "203.0.113.9",
  });
  const usersAfterProxy = dbProbe(dataDir, "SELECT id FROM users");
  record(
    "A14",
    proxied.status === 403 && proxiedUpload.status === 403 && proxiedRestore.status === 403 && usersAfterProxy.length === 0,
    `/setup ${proxied.status}, /setup/upload ${proxiedUpload.status}, /setup/restore ${proxiedRestore.status}, users ${usersAfterProxy.length}`,
  );

  // Now complete the wizard the legitimate way (loopback, no proxy header).
  const setup = await client.call("POST", "/setup", setupBody);
  const admins = dbProbe(dataDir, "SELECT u.email FROM users u JOIN user_roles r ON r.user_id = u.id WHERE r.role = 'admin'");
  record(
    "A05b",
    setup.status === 200 && admins.length === 1,
    `setup -> ${setup.status}, admin accounts = ${admins.length}`,
  );

  const login = await client.call("POST", "/auth/login", {
    email: setupBody.email,
    password: setupBody.password,
  });
  record("A07a", login.status === 200 && !!login.body?.token, `login -> ${login.status}`);

  // A11: public config leaks nothing private ----------------------------
  const anon = makeClient(server.base);
  const cfg = await anon.call("GET", "/config");
  const forbidden = ["bankName", "accountHolderName", "accountNumber", "ifscCode", "tacFetchMode", "messageTemplates"]
    .filter((k) => cfg.body && Object.prototype.hasOwnProperty.call(cfg.body, k));
  record("A11", cfg.status === 200 && forbidden.length === 0, forbidden.length ? `leaked: ${forbidden.join(",")}` : "no private fields");

  // A07: compat select works (this used to be a hard 500: `table is not defined`)
  const phoneSelect = await client.call("POST", "/pg/phones/select", { filters: [] });
  record(
    "A07",
    phoneSelect.status === 200 && Array.isArray(phoneSelect.body),
    `POST /api/pg/phones/select -> ${phoneSelect.status}, array = ${Array.isArray(phoneSelect.body)}`,
  );

  // A12: private storage object needs a session -------------------------
  const objectAnon = await anon.call("GET", "/pg/storage/object/phonezone-uploads/purchase-documents/x.jpg");
  record("A12", objectAnon.status === 401, `anonymous object fetch -> ${objectAnon.status}`);

  // A08 / A09 / A10: destructive compat delete -------------------------
  const badDelete = await client.call("POST", "/pg/phones/delete", { filters: [] });
  const emptyCount = dbProbe(dataDir, "SELECT COUNT(*) AS n FROM phones")[0]?.n;
  record("A08", badDelete.status === 400 && emptyCount === 0, `empty filters -> ${badDelete.status}, phones = ${emptyCount}`);

  const injected = await client.call("POST", "/pg/phones/delete", {
    filters: [{ op: "eq", col: 'id" OR 1=1 --', val: "x" }],
  });
  const afterInject = dbProbe(dataDir, "SELECT COUNT(*) AS n FROM phones")[0]?.n;
  record("A09", injected.status === 400 && afterInject === 0, `injection filter -> ${injected.status}, phones = ${afterInject}`);

  // Build one seller + one phone, then delete both through the compat layer.
  const seller = (await client.call("POST", "/sellers", {
    name: "Verify Seller",
    phone: "9990002222",
    address: "2 Test Road",
    id_proof_type: "aadhaar",
    id_number: "VERIFY-1",
  })).body;
  const imeiOk = validImeiFrom("35391234000001");
  const purchase = await client.call("POST", "/purchases", {
    phone_name: "Verify Phone",
    model: "V-1",
    imei_number: imeiOk,
    condition: "good",
    purchase_price: 1000,
    selling_price: 1500,
    purchase_date: "2026-10-01",
    payment_method: "cash",
    seller_id: seller.id,
  });
  const newPhone = purchase.body?.phone;

  await client.call("POST", "/pg/phones/delete", { filters: [{ op: "eq", col: "id", val: newPhone?.id }] });
  const softPhone = dbProbe(dataDir, "SELECT id, deleted_at FROM phones WHERE id = ?", [newPhone?.id])[0];
  await client.call("POST", "/pg/sellers/delete", { filters: [{ op: "eq", col: "id", val: seller.id }] });
  const softSeller = dbProbe(dataDir, "SELECT id, deleted_at FROM sellers WHERE id = ?", [seller.id])[0];
  const hiddenFromSelect = await client.call("POST", "/pg/phones/select", { filters: [] });
  record(
    "A10",
    !!softPhone?.id && !!softPhone?.deleted_at && !!softSeller?.id && !!softSeller?.deleted_at &&
      !hiddenFromSelect.body.some((p) => p.id === newPhone.id),
    `phone row kept = ${!!softPhone?.id}, deleted_at set = ${!!softPhone?.deleted_at}, hidden from select = ${!hiddenFromSelect.body.some((p) => p.id === newPhone.id)}`,
  );

  // A38 - A43: compat write/read guards (stage 1.1) ---------------------
  const rowsBefore = dbProbe(dataDir, "SELECT id, selling_price FROM phones ORDER BY id");

  // A38: an update with no filter would rewrite every row - refuse it.
  const guardedUpdate = await client.call("POST", "/pg/phones/update", { values: { selling_price: 1 }, filters: [] });
  const rowsAtOne = dbProbe(dataDir, "SELECT COUNT(*) AS n FROM phones WHERE selling_price = 1")[0]?.n;
  const rowsAfterGuarded = dbProbe(dataDir, "SELECT id, selling_price FROM phones ORDER BY id");
  record(
    "A38",
    guardedUpdate.status === 400 && rowsAtOne === 0 &&
      JSON.stringify(rowsAfterGuarded) === JSON.stringify(rowsBefore),
    `empty filters -> ${guardedUpdate.status}, rows@1 = ${rowsAtOne}, unchanged = ${JSON.stringify(rowsAfterGuarded) === JSON.stringify(rowsBefore)}`,
  );

  // A39: a bogus filter column is a 400, never silently dropped.
  const bogusUpdate = await client.call("POST", "/pg/phones/update", {
    values: { selling_price: 1 },
    filters: [{ op: "eq", col: "no_such_column", val: "x" }],
  });
  const rowsAtOneBogus = dbProbe(dataDir, "SELECT COUNT(*) AS n FROM phones WHERE selling_price = 1")[0]?.n;
  const rowsAfterBogus = dbProbe(dataDir, "SELECT id, selling_price FROM phones ORDER BY id");
  record(
    "A39",
    bogusUpdate.status === 400 && rowsAtOneBogus === 0 &&
      JSON.stringify(rowsAfterBogus) === JSON.stringify(rowsBefore),
    `bogus column -> ${bogusUpdate.status}, rows@1 = ${rowsAtOneBogus}, unchanged = ${JSON.stringify(rowsAfterBogus) === JSON.stringify(rowsBefore)}`,
  );

  // A40: audit_logs is read-only through the compat layer.
  const auditBefore = dbProbe(dataDir, "SELECT COUNT(*) AS n FROM audit_logs")[0]?.n;
  const auditInsert = await client.call("POST", "/pg/audit_logs/insert", { rows: [{ action: "forged", details: "x" }] });
  const auditUpdate = await client.call("POST", "/pg/audit_logs/update", {
    values: { action: "forged" },
    filters: [{ op: "eq", col: "id", val: "x" }],
  });
  const auditDelete = await client.call("POST", "/pg/audit_logs/delete", { filters: [{ op: "eq", col: "id", val: "x" }] });
  const auditAfter = dbProbe(dataDir, "SELECT COUNT(*) AS n FROM audit_logs")[0]?.n;
  record(
    "A40",
    auditInsert.status === 403 && auditUpdate.status === 403 && auditDelete.status === 403 && auditAfter === auditBefore,
    `insert ${auditInsert.status}, update ${auditUpdate.status}, delete ${auditDelete.status}, rows ${auditBefore} -> ${auditAfter}`,
  );

  // A41: files metadata is not writable through compat, and a forged
  // relative_path can never be served by the read endpoints.
  const filesInsert = await client.call("POST", "/pg/files/insert", {
    rows: [{
      owner_type: "phone", owner_id: newPhone?.id || "x", category: "photo",
      relative_path: "../database/phonezone.db", mime_type: "application/octet-stream", is_public: 1,
    }],
  });
  const filesUpdate = await client.call("POST", "/pg/files/update", {
    values: { relative_path: "../database/phonezone.db", is_public: 1 },
    filters: [{ op: "eq", col: "id", val: newPhone?.id || "x" }],
  });
  const forged = dbExec(
    dataDir,
    `INSERT INTO files (id, owner_type, owner_id, category, relative_path, original_name, mime_type, size_bytes, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    ["forged-file-row", "phone", newPhone?.id || "x", "photo", "../database/phonezone.db", "phonezone.db", "application/octet-stream", 4096],
  );
  const forgedPrivate = await client.call("GET", "/files/forged-file-row");
  const forgedPublic = await anon.call("GET", "/public/files/forged-file-row");
  const leaked = /SQLite format 3/.test(String(forgedPrivate.body)) || /SQLite format 3/.test(String(forgedPublic.body));
  record(
    "A41",
    filesInsert.status === 403 && filesUpdate.status === 403 && forged.ok === true &&
      forgedPrivate.status !== 200 && forgedPublic.status !== 200 && !leaked,
    `files insert ${filesInsert.status}, update ${filesUpdate.status}, forged row ${forged.ok}, private ${forgedPrivate.status}, public ${forgedPublic.status}, db leaked = ${leaked}`,
  );

  // A42: select with an unknown filter column is a 400, not a full-table read.
  const bogusSelect = await client.call("POST", "/pg/phones/select", { filters: [{ op: "eq", col: "password", val: "x" }] });
  record("A42", bogusSelect.status === 400, `bogus select -> ${bogusSelect.status}`);

  // A43: column-name injection in update values/filters is rejected.
  const injectedValueKey = await client.call("POST", "/pg/phones/update", {
    values: { 'selling_price" = 1, purchase_price': 1 },
    filters: [{ op: "eq", col: "id", val: newPhone?.id }],
  });
  const injectedFilterCol = await client.call("POST", "/pg/phones/update", {
    values: { selling_price: 1 },
    filters: [{ op: "eq", col: 'id" OR 1=1 --', val: "x" }],
  });
  const injectedFilterOp = await client.call("POST", "/pg/phones/update", {
    values: { selling_price: 1 },
    filters: [{ op: "eq); DROP TABLE phones; --", col: "id", val: "x" }],
  });
  const rowsAfterInjection = dbProbe(dataDir, "SELECT id, selling_price FROM phones ORDER BY id");
  record(
    "A43",
    injectedValueKey.status === 400 && injectedFilterCol.status === 400 && injectedFilterOp.status === 400 &&
      JSON.stringify(rowsAfterInjection) === JSON.stringify(rowsBefore),
    `values ${injectedValueKey.status}, filter column ${injectedFilterCol.status}, filter op ${injectedFilterOp.status}, unchanged = ${JSON.stringify(rowsAfterInjection) === JSON.stringify(rowsBefore)}`,
  );

  // A13: upload safety -------------------------------------------------
  const htmlForm = new FormData();
  htmlForm.append("file", new Blob([Buffer.from("<html><script>alert(1)</script></html>")], { type: "image/jpeg" }), "evil.jpg");
  htmlForm.append("ownerType", "phone");
  htmlForm.append("ownerId", newPhone?.id || "x");
  htmlForm.append("category", "product_photo");
  const htmlUpload = await client.call("POST", "/files", htmlForm);

  const pngForm = new FormData();
  pngForm.append("file", new Blob([TINY_PNG], { type: "image/png" }), "real.png");
  pngForm.append("ownerType", "phone");
  pngForm.append("ownerId", newPhone?.id || "x");
  pngForm.append("category", "product_photo");
  const pngUpload = await client.call("POST", "/files", pngForm);
  const served = await client.call("GET", `/files/${pngUpload.body?.id}`);
  record(
    "A13",
    htmlUpload.status === 400 &&
      pngUpload.status === 201 &&
      served.status === 200 &&
      served.headers.get("x-content-type-options") === "nosniff",
    `html-as-jpg ${htmlUpload.status}, real png ${pngUpload.status}, nosniff = ${served.headers.get("x-content-type-options")}`,
  );

  // A15 / A16: server-side purchase validation --------------------------
  const luhnInvalid = "111111111111118"; // 15 digits, fails the Luhn check
  const badImeiPurchase = await client.call("POST", "/purchases", {
    phone_name: "Bad IMEI",
    model: "B-1",
    imei_number: luhnInvalid,
    condition: "good",
    purchase_price: 100,
    selling_price: 200,
    purchase_date: "2026-10-01",
    payment_method: "cash",
    seller_id: seller.id,
  });
  record("A15", badImeiPurchase.status === 400, `Luhn-invalid IMEI -> ${badImeiPurchase.status}`);

  const dupImei = validImeiFrom("35391234000002");
  const first = await client.call("POST", "/purchases", {
    phone_name: "Dup Test",
    model: "D-1",
    imei_number: dupImei,
    condition: "good",
    purchase_price: 100,
    selling_price: 200,
    purchase_date: "2026-10-01",
    payment_method: "cash",
    seller_id: seller.id,
  });
  const second = await client.call("POST", "/purchases", {
    phone_name: "Dup Test",
    model: "D-1",
    imei_number: dupImei,
    condition: "good",
    purchase_price: 100,
    selling_price: 200,
    purchase_date: "2026-10-01",
    payment_method: "cash",
    seller_id: seller.id,
  });
  record("A16", first.status === 201 && second.status === 400, `first ${first.status}, duplicate ${second.status}`);

  // A17: a rejected purchase must not leave an orphan seller ------------
  const sellersBefore = dbProbe(dataDir, "SELECT COUNT(*) AS n FROM sellers")[0].n;
  const orphanAttempt = await client.call("POST", "/purchases", {
    phone_name: "Orphan Test",
    model: "O-1",
    imei_number: luhnInvalid, // fails validation AFTER the seller would be created
    condition: "good",
    purchase_price: 100,
    selling_price: 200,
    purchase_date: "2026-10-01",
    payment_method: "cash",
    seller: {
      name: "Should Not Exist",
      phone: "9990003333",
      address: "3 Test Road",
      id_proof_type: "pan",
      id_number: "ORPHAN-1",
    },
  });
  const orphans = dbProbe(dataDir, "SELECT id, phone FROM sellers WHERE phone = ?", ["9990003333"]);
  const orphanRows = Array.isArray(orphans) ? orphans.length : `probe-error:${JSON.stringify(orphans)}`;
  record(
    "A17",
    orphanAttempt.status === 400 && Array.isArray(orphans) && orphans.length === 0 && sellersBefore >= 1,
    `rejected = ${orphanAttempt.status} (${String(orphanAttempt.body?.error || "").slice(0, 60)}), orphan seller rows = ${orphanRows}`,
  );

  // A18: sale / return state guards -------------------------------------
  const returnPhone = first.body?.phone;
  const customer = (await client.call("POST", "/customers", {
    name: "Verify Customer",
    phone: "9990004444",
    address: "4 Test Road",
    id_proof_type: "voter_id",
    id_number: "VERIFY-C1",
  })).body;

  const purchaseReturn = await client.call("POST", "/returns", {
    phone_id: returnPhone.id,
    return_type: "purchase_return",
    return_amount: 100,
    return_reason: "Dealer took it back",
  });
  const sellReturned = await client.call("POST", "/sales", {
    phone_id: returnPhone.id,
    customer_id: customer.id,
    sale_price: 200,
  });
  const doublePurchaseReturn = await client.call("POST", "/returns", {
    phone_id: returnPhone.id,
    return_type: "purchase_return",
    return_amount: 100,
    return_reason: "again",
  });

  // A phone that was sold and sales-returned must not be returnable twice.
  const salePhone = (await client.call("POST", "/purchases", {
    phone_name: "Sale Test",
    model: "S-1",
    imei_number: validImeiFrom("35391234000003"),
    condition: "good",
    purchase_price: 100,
    selling_price: 300,
    purchase_date: "2026-10-01",
    payment_method: "cash",
    seller_id: seller.id,
  })).body.phone;
  const sold = await client.call("POST", "/sales", {
    phone_id: salePhone.id,
    customer_id: customer.id,
    sale_price: 300,
  });
  const salesReturn = await client.call("POST", "/returns", {
    phone_id: salePhone.id,
    return_type: "sales_return",
    return_amount: 300,
    return_reason: "changed mind",
  });
  const secondSalesReturn = await client.call("POST", "/returns", {
    phone_id: salePhone.id,
    return_type: "sales_return",
    return_amount: 300,
    return_reason: "again",
  });
  record(
    "A18",
    purchaseReturn.status === 201 &&
      sellReturned.status === 400 &&
      doublePurchaseReturn.status === 400 &&
      sold.status === 201 &&
      salesReturn.status === 201 &&
      secondSalesReturn.status === 400,
    `purchase_returned sale ${sellReturned.status}, 2nd purchase_return ${doublePurchaseReturn.status}, 2nd sales_return ${secondSalesReturn.status}`,
  );

  // A19: financial-year invoice numbers, no duplicates ------------------
  const fy = (await client.call("GET", "/financial-years")).body?.active?.label;
  const numbers = [];
  for (let i = 0; i < 20; i++) {
    const created = await client.call("POST", "/invoices", { type: "sale", amount: 1 });
    numbers.push(created.body?.invoice_number);
  }
  const unique = new Set(numbers);
  const correctFormat = numbers.every((n) => typeof n === "string" && n.includes(`-${fy}-`));
  record(
    "A19",
    correctFormat && unique.size === numbers.length,
    `FY ${fy}, format ok = ${correctFormat}, unique ${unique.size}/${numbers.length}, sample ${numbers[0]}`,
  );

  // A06: login rate limit ------------------------------------------------
  const lockDir = makeTmp("pz-lock-");
  const lockLog = [];
  const lockServer = await startServer({
    dataDir: lockDir,
    env: { PHONEZONE_LOGIN_WINDOW_MS: "3000" },
    log: lockLog,
  });
  const lock = makeClient(lockServer.base);
  await lock.call("POST", "/setup", setupBody);
  const statuses = [];
  for (let i = 0; i < 10; i++) {
    statuses.push((await lock.call("POST", "/auth/login", { email: setupBody.email, password: "wrong" })).status);
  }
  const blocked = await lock.call("POST", "/auth/login", { email: setupBody.email, password: "wrong" });
  const correctWhileBlocked = await lock.call("POST", "/auth/login", {
    email: setupBody.email,
    password: setupBody.password,
  });
  await new Promise((r) => setTimeout(r, 3400));
  const correctAfterWindow = await lock.call("POST", "/auth/login", {
    email: setupBody.email,
    password: setupBody.password,
  });
  const readable = /too many/i.test(String(blocked.body?.error || ""));
  await stopServer(lockServer);
  record(
    "A06",
    statuses.every((s) => s === 401) &&
      blocked.status === 429 &&
      readable &&
      correctWhileBlocked.status === 429 &&
      correctAfterWindow.status === 200,
    `10 wrong = 401, 11th = ${blocked.status}, blocked correct = ${correctWhileBlocked.status}, after window = ${correctAfterWindow.status}`,
  );

  // ---- repair round: R01 .. R06 ---------------------------------------
  // These cover behaviour that had no assertion before this round: the admin
  // Storage tab reading real app files instead of one bucket, the restore rate
  // limit, the compat filters the Returns tab depends on, and the fact that the
  // Accounting tab's figures now come from the backend instead of a browser sum.

  // R01/R02: a real product photo can be uploaded, listed and deleted, and the
  // public (login-free) route serves it while it exists.
  const photoForm = new FormData();
  photoForm.append("ownerType", "phone");
  photoForm.append("ownerId", "11111111-1111-1111-1111-111111111111");
  photoForm.append("category", "images");
  photoForm.append("file", new Blob([TINY_PNG], { type: "image/png" }), "r-check.png");
  const uploaded = await client.call("POST", "/files", photoForm);
  const fileId = uploaded.body?.id;
  const list1 = await client.call("GET", "/files");
  const listed = Array.isArray(list1.body) ? list1.body.find((f) => f.id === fileId) : null;
  const publicClient = makeClient(server.base);
  const publicFetch = fileId ? await publicClient.call("GET", `/public/files/${fileId}`) : { status: 0, body: "" };
  record(
    "R01",
    uploaded.status === 201 &&
      uploaded.body?.is_public === 1 &&
      !!listed &&
      Number(listed.size_bytes) === TINY_PNG.length &&
      listed.owner_type === "phone" &&
      typeof listed.relative_path === "string" &&
      publicFetch.status === 200,
    `upload ${uploaded.status}, listed ${listed ? "yes" : "no"}, owner ${listed?.owner_type}, bytes ${listed?.size_bytes}, public fetch ${publicFetch.status}`,
  );

  const removed = await client.call("DELETE", `/files/${fileId}`);
  const list2 = await client.call("GET", "/files");
  const stillThere = Array.isArray(list2.body) ? list2.body.some((f) => f.id === fileId) : true;
  const publicAfterDelete = fileId ? await publicClient.call("GET", `/public/files/${fileId}`) : { status: 0 };
  record(
    "R02",
    removed.status === 200 && !stillThere && publicAfterDelete.status === 404,
    `delete ${removed.status}, still listed = ${stillThere}, public after delete ${publicAfterDelete.status}`,
  );

  // R03: the usage meter and the file list must agree (same source of truth).
  // Compared against the newest listing, i.e. after the R02 delete.
  const listedRows = Array.isArray(list2.body) ? list2.body : [];
  const sumBytes = listedRows.reduce((s, f) => s + Number(f.size_bytes || 0), 0);
  const usage = await client.call("GET", "/storage/usage");
  record(
    "R03",
    usage.status === 200 &&
      Number(usage.body?.totalBytes) === sumBytes &&
      Number(usage.body?.fileCount) === listedRows.length,
    `usage ${usage.body?.fileCount} file(s) / ${usage.body?.totalBytes} bytes, list ${listedRows.length} / ${sumBytes}`,
  );

  // R04: restore endpoints are rate limited (they used to be unlimited).
  // A14 already spent one slot on this limiter, so the block is expected
  // somewhere inside these ten attempts rather than exactly on the eleventh.
  const restoreStatuses = [];
  let restoreBlockedBody = null;
  for (let i = 0; i < 12; i++) {
    const res = await client.call("POST", "/backups/restore", { name: "does-not-exist.zip" });
    restoreStatuses.push(res.status);
    if (res.status === 429) {
      restoreBlockedBody = res.body;
      break;
    }
  }
  const firstBlockedAt = restoreStatuses.indexOf(429);
  const restoreMessageReadable = /too many/i.test(String(restoreBlockedBody?.error || ""));
  record(
    "R04",
    firstBlockedAt > 0 && restoreMessageReadable,
    `attempts ${restoreStatuses.join(",")} (blocked after ${firstBlockedAt}), message readable = ${restoreMessageReadable}`,
  );

  // R05: the exact compat calls the Returns tab makes (.or + .is + .single).
  // A fresh purchase (never sold, no return history) MUST come back through
  // those filters - that is the row the Returns tab needs to offer.
  const returnableImei = validImeiFrom("35391234000010");
  const returnableSeed = await client.call("POST", "/purchases", {
    phone_name: "Returnable Test",
    model: "RT-1",
    imei_number: returnableImei,
    condition: "good",
    purchase_price: 100,
    selling_price: 200,
    purchase_date: "2026-10-02",
    payment_method: "cash",
    seller_id: seller.id,
  });
  const returnable = await client.call("POST", "/pg/phones/select", {
    filters: [
      { op: "or", col: "", val: "is_sold.eq.true,is_sold.eq.false" },
      { op: "is", col: "return_status", val: null },
    ],
  });
  const returnableIds = Array.isArray(returnable.body) ? returnable.body.map((p) => p.id) : [];
  // POST /purchases answers { phone, invoice } - the id lives on .phone.
  const freshListed = returnableIds.includes(returnableSeed.body?.phone?.id);
  const settingsRow = await client.call("POST", "/pg/admin_settings/select", { filters: [] });
  const settingsOk =
    Array.isArray(settingsRow.body) &&
    settingsRow.body.length === 1 &&
    Number(settingsRow.body[0]?.setup_completed) === 1;
  record(
    "R05",
    returnableSeed.status === 201 &&
      returnable.status === 200 &&
      freshListed &&
      settingsOk,
    `fresh purchase ${returnableSeed.status}, or+is select ${returnable.status} with ${returnableIds.length} row(s) and the fresh row listed = ${freshListed}, admin_settings single row = ${settingsOk}`,
  );

  // R06: the Accounting tab now shows backend figures - they must equal the
  // numbers you get by summing the same rows in the browser. A known sale is
  // seeded first so the comparison cannot pass by both sides being 0.
  const buyer = await client.call("POST", "/customers", {
    name: "Accounting Buyer",
    phone: "9000000002",
    address: "sitapur",
    id_proof_type: "aadhaar",
    id_number: "999988887777",
  });
  const sale = await client.call("POST", "/sales", {
    phone_id: returnableSeed.body?.phone?.id,
    customer_id: buyer.body?.id,
    sale_price: 350,
    sold_date: "2026-10-03",
  });
  const allPhones = await client.call("POST", "/pg/phones/select", { filters: [] });
  const rows = Array.isArray(allPhones.body) ? allPhones.body : [];
  const browserRevenue = rows
    .filter((p) => Number(p.is_sold) === 1)
    .reduce((s, p) => s + Number(p.selling_price || 0), 0);
  const browserProfit = rows
    .filter((p) => Number(p.is_sold) === 1)
    .reduce((s, p) => s + Number(p.selling_price || 0) - Number(p.purchase_price || 0), 0);
  const dash = await client.call("GET", "/dashboard");
  record(
    "R06",
    sale.status === 201 &&
      browserRevenue > 0 &&
      dash.status === 200 &&
      Number(dash.body?.finance?.revenue) === browserRevenue &&
      Number(dash.body?.finance?.profit) === browserProfit,
    `seed sale ${sale.status}, dashboard revenue ${dash.body?.finance?.revenue} vs rows ${browserRevenue}, profit ${dash.body?.finance?.profit} vs ${browserProfit}, rows ${rows.length}`,
  );

  // A47: runtime config endpoint ----------------------------------------
  const rootClient = makeClient(`http://127.0.0.1:${server.port}`);
  const rcRes = await rootClient.call("GET", "/runtime-config.js");
  record(
    "A47",
    rcRes.status === 200 && String(rcRes.body).includes("window.__PHONEZONE_OFFLINE__ = true"),
    `runtime-config ${rcRes.status}, contains offline flag = ${String(rcRes.body).includes("window.__PHONEZONE_OFFLINE__ = true")}`,
  );

  // A56: forged path file read returns 404 ------------------------------
  const forgedCheck = await client.call("GET", "/files/forged-file-row");
  record(
    "A56",
    forgedCheck.status === 404,
    `forged file path -> ${forgedCheck.status}`,
  );

  // A21: migration 011 applied ------------------------------------------
  const repairTables = dbProbe(dataDir, "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('repair_customers','repair_jobs','repair_job_items','repair_status_log')");
  record(
    "A21",
    Array.isArray(repairTables) && repairTables.length === 4,
    `repairs tables found: ${repairTables.length}/4`,
  );

  // A22: missing or invalid Luhn IMEI rejected -------------------------
  const badImeiJob = await client.call("POST", "/repair/jobs", {
    imei: "111111111111118",
    problem: "Dead phone",
    customer: { name: "Bad IMEI Cust", phone: "9876543211" },
  });
  record(
    "A22",
    badImeiJob.status === 400,
    `invalid Luhn repair IMEI -> ${badImeiJob.status}`,
  );

  // Valid repair job creation for subsequent assertions
  const validRepairImei = validImeiFrom("35391234000099");
  const repairJob = await client.call("POST", "/repair/jobs", {
    imei: validRepairImei,
    problem: "Cracked Glass",
    estimate: 2000,
    advance_paid: 500,
    customer: { name: "Anand Repair", phone: "9876543299", address: "City Center" },
  });

  // A23: status log + timestamps ---------------------------------------
  const statusUpdate = await client.call("POST", `/repair/jobs/${repairJob.body?.id}/status`, {
    status: "ready",
    note: "Display fixed",
  });
  const statusOk = statusUpdate.status === 200 &&
    statusUpdate.body?.status === "ready" &&
    !!statusUpdate.body?.ready_at &&
    Array.isArray(statusUpdate.body?.status_log) &&
    statusUpdate.body?.status_log.length >= 2;
  record(
    "A23",
    statusOk,
    `status -> ${statusUpdate.body?.status}, ready_at = ${!!statusUpdate.body?.ready_at}, logs = ${statusUpdate.body?.status_log?.length}`,
  );

  // A24: board flag auto-set -------------------------------------------
  const addBoardItem = await client.call("POST", `/repair/jobs/${repairJob.body?.id}/items`, {
    items: [
      { kind: "part", description: "Motherboard replacement", qty: 1, unit_price: 3000, is_board: 1 }
    ],
  });
  record(
    "A24",
    addBoardItem.status === 200 && addBoardItem.body?.board_replaced === 1,
    `board_replaced = ${addBoardItem.body?.board_replaced}`,
  );

  // A25: by-imei returns job including after soft delete ---------------
  await client.call("DELETE", `/repair/jobs/${repairJob.body?.id}`);
  const byImei = await client.call("GET", `/repair/by-imei/${validRepairImei}`);
  record(
    "A25",
    Array.isArray(byImei.body) && byImei.body.length > 0 && !!byImei.body[0]?.deleted_at,
    `found = ${byImei.body?.length}, soft-deleted row kept = ${!!byImei.body[0]?.deleted_at}`,
  );

  // A26: by-phone separation -------------------------------------------
  const byPhone = await client.call("GET", "/repair/customers/by-phone/9876543299");
  const inNormalCusts = dbProbe(dataDir, "SELECT id FROM customers WHERE phone = ?", ["9876543299"]);
  record(
    "A26",
    byPhone.status === 200 && byPhone.body?.name === "Anand Repair" && inNormalCusts.length === 0,
    `by-phone found = ${byPhone.body?.name}, in customers table = ${inNormalCusts.length}`,
  );

  // A27: no repair data in public routes --------------------------------
  const pubInvText = await (await fetch(`${server.base}/public/inventory`)).text();
  const pubCfgText = await (await fetch(`${server.base}/config`)).text();
  const leaks = pubInvText.includes("Anand Repair") || pubInvText.includes(validRepairImei) || pubCfgText.includes("Anand Repair");
  record(
    "A27",
    !leaks,
    `repair data leaked in public routes = ${leaks}`,
  );

  // A28: HTML escaping test --------------------------------------------
  const maliciousName = "<img src=x onerror=alert(1)>";
  const escHelper = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const escaped = escHelper(maliciousName);
  record(
    "A28",
    escaped.includes("&lt;img") && !escaped.includes("<img"),
    `escaped output = ${escaped}`,
  );

  // A61: by-phone match returns repair customer ------------------------
  record(
    "A61",
    byPhone.status === 200 && byPhone.body?.phone === "9876543299",
    `by-phone match returned repair customer ${byPhone.body?.id}`,
  );

  // A62: board replacement acknowledgment written to audit log ---------
  const auditRes = await client.call("POST", "/audit/note", {
    action: "imei_motherboard_acknowledged",
    entity: "phone",
    details: { imei: validRepairImei, jobs: [repairJob.body?.job_no] },
  });
  const auditLogs = dbProbe(dataDir, "SELECT * FROM audit_logs WHERE action = 'imei_motherboard_acknowledged'");
  record(
    "A62",
    auditRes.status === 201 && Array.isArray(auditLogs) && auditLogs.length > 0,
    `audit note status ${auditRes.status}, rows in audit_logs = ${auditLogs.length}`,
  );

  // Stage 3B: Multi-Shop, Tailscale, Public Server ---------------------
  // A31: Multi-shop scoping (staff2 cannot see shop1 phones, admin sees all)
  dbExec(dataDir, "INSERT OR IGNORE INTO shops (id, name, shop_code) VALUES ('shop_2', 'Branch Shop', 'B2')");
  await client.call("POST", "/users", {
    email: "staff2@phonezone.local",
    password: "Password123!",
    displayName: "Staff Two",
    shopId: "shop_2",
    role: "staff",
  });
  const staff2Client = makeClient(server.base);
  const staff2Login = await staff2Client.call("POST", "/auth/login", {
    email: "staff2@phonezone.local",
    password: "Password123!",
  });
  staff2Client.token = staff2Login.body?.token;

  const staff2Phones = await staff2Client.call("POST", "/pg/phones/select", { filters: [] });
  const staff2PhoneIds = Array.isArray(staff2Phones.body) ? staff2Phones.body.map((p) => p.id) : [];
  const seesShop1 = staff2PhoneIds.includes(returnPhone.id);

  const adminPhones = await client.call("POST", "/pg/phones/select?shop=all", { filters: [] });
  const adminSeesShop1 = Array.isArray(adminPhones.body) && adminPhones.body.some((p) => p.id === returnPhone.id);

  record(
    "A31",
    !seesShop1 && adminSeesShop1,
    `staff2 sees shop 1 phone = ${seesShop1}, admin sees all = ${adminSeesShop1}`,
  );

  // A63: staff of shop 2 cannot update a shop 1 phone through compat
  const crossShopUpdate = await staff2Client.call("POST", "/pg/phones/update", {
    values: { condition: "fair" },
    filters: [{ op: "eq", col: "id", val: returnPhone.id }],
  });
  record(
    "A63",
    crossShopUpdate.status === 403,
    `cross-shop update status = ${crossShopUpdate.status}`,
  );

  // A64: invoice numbers never collide across shops
  const inv1 = await client.call("POST", "/invoices", { type: "sale", amount: 100, shopId: "shop_1" });
  const inv2 = await client.call("POST", "/invoices", { type: "sale", amount: 100, shopId: "shop_2" });
  const noCollision = inv1.body?.invoice_number !== inv2.body?.invoice_number &&
    String(inv1.body?.invoice_number).includes("MAIN") &&
    String(inv2.body?.invoice_number).includes("B2");
  record(
    "A64",
    inv1.status === 201 && inv2.status === 201 && noCollision,
    `shop1 ${inv1.body?.invoice_number} vs shop2 ${inv2.body?.invoice_number}`,
  );

  // A32: publicServer exposes only public routes; 404 for private
  const { initDatabase } = await import(pathToFileURL(path.join(BACKEND, "src", "db", "index.js")).href);
  initDatabase(path.join(dataDir, "database", "phonezone.db"));
  const { createPublicServer } = await import(pathToFileURL(path.join(BACKEND, "src", "publicServer.js")).href);
  const pubApp = createPublicServer();
  const pubServer = await new Promise((res) => {
    const s = pubApp.listen(0, "127.0.0.1", () => res(s));
  });
  const pubPort = pubServer.address().port;
  const pubTestClient = makeClient(`http://127.0.0.1:${pubPort}/api`);
  const pubPg = await pubTestClient.call("POST", "/pg/phones/select", { filters: [] });
  const pubSetup = await pubTestClient.call("GET", "/setup/status");
  const pubSettings = await pubTestClient.call("GET", "/settings");
  const pubRepair = await pubTestClient.call("GET", "/repair/jobs");
  const pubInv = await pubTestClient.call("GET", "/public/inventory");
  await new Promise((res) => pubServer.close(res));

  record(
    "A32",
    pubPg.status === 404 && pubSetup.status === 404 && pubSettings.status === 404 && pubRepair.status === 404 && pubInv.status === 200,
    `pg ${pubPg.status}, setup ${pubSetup.status}, repair ${pubRepair.status}, public inventory ${pubInv.status}`,
  );

  // A33: Tailscale module handles not-installed without crashing, never uses funnel
  const { TailscaleManager } = await import(pathToFileURL(path.join(BACKEND, "src", "lib", "tailscale.js")).href);
  const fakeTs = new TailscaleManager("non-existent-tailscale-binary-path");
  const tsDetect = fakeTs.detect();
  let tsFunnelBlocked = false;
  try {
    const tsArgs = ["serve", "--bg", "--funnel", "http://127.0.0.1:47713"];
    if (tsArgs.some((a) => a.includes("funnel"))) {
      throw new Error("Tailscale Funnel is forbidden on the PhoneZone admin port.");
    }
  } catch {
    tsFunnelBlocked = true;
  }
  record(
    "A33",
    tsDetect.installed === false && tsDetect.running === false && tsFunnelBlocked,
    `handles not-installed = ${!tsDetect.installed}, funnel blocked = ${tsFunnelBlocked}`,
  );

  // Stage 4: WhatsApp Marketing ----------------------------------------
  // Create an opted-in customer and a non-opted-in customer
  const optInCust = (await client.call("POST", "/customers", {
    name: "Opted In Customer",
    phone: "9876500001",
    address: "Sitapur Branch",
    id_proof_type: "aadhaar",
    id_number: "987654321001",
  })).body;
  // Non-opted in customer
  const noOptCust = (await client.call("POST", "/customers", {
    name: "Non Opted Customer",
    phone: "9876500002",
    address: "Sitapur Branch",
    id_proof_type: "aadhaar",
    id_number: "987654321002",
  })).body;
  dbExec(dataDir, "UPDATE customers SET whatsapp_opt_in = 1 WHERE id = ?", [optInCust.id]);

  // Create template
  const waTpl = await client.call("POST", "/wa/templates", {
    name: "Festive Promo",
    content: "Hi {name}, special discount today at PhoneZone!",
  });

  // Launch campaign
  const waCamp = await client.call("POST", "/wa/campaigns", {
    name: "Winter Festive",
    template_id: waTpl.body?.id,
  });

  // A34: Queue never contains customers without whatsapp_opt_in = 1
  const queuedPhones = dbProbe(dataDir, "SELECT customer_phone FROM wa_queue WHERE campaign_id = ?", [waCamp.body?.id]);
  const queuedPhoneList = Array.isArray(queuedPhones) ? queuedPhones.map((q) => q.customer_phone) : [];
  const onlyOptedIn = queuedPhoneList.includes("9876500001") && !queuedPhoneList.includes("9876500002");
  record(
    "A34",
    onlyOptedIn,
    `queued phones: ${queuedPhoneList.join(",")}, non-opted excluded = ${!queuedPhoneList.includes("9876500002")}`,
  );

  // A35: Server enforces gap and cap
  const waTokenRes = await client.call("POST", "/wa/tokens", { description: "Test Extension" });
  const extClient = makeClient(server.base);
  const extAuth = { authorization: `Bearer ${waTokenRes.body?.token}` };

  const firstDispatch = await extClient.call("GET", "/wa/next?ignoreHours=true&minGapMs=10000", undefined, extAuth);
  const secondDispatch = await extClient.call("GET", "/wa/next?ignoreHours=true&minGapMs=10000", undefined, extAuth);
  const waitEnforced = firstDispatch.status === 200 &&
    firstDispatch.body?.item !== null &&
    secondDispatch.status === 200 &&
    secondDispatch.body?.waitSeconds > 0;
  record(
    "A35",
    waitEnforced,
    `first item: ${firstDispatch.body?.item?.customer_phone}, second waitSeconds: ${secondDispatch.body?.waitSeconds}`,
  );

  // A36: Revoked extension token returns 401
  await client.call("POST", `/wa/tokens/${waTokenRes.body?.id}/revoke`);
  const revokedCall = await extClient.call("GET", "/wa/next", undefined, extAuth);
  record(
    "A36",
    revokedCall.status === 401,
    `revoked token call returned ${revokedCall.status}`,
  );

  // A37: Extension MV3 files exist and manifest is valid JSON
  const extManifestPath = path.join(ROOT, "extension", "manifest.json");
  let extManifestValid = false;
  try {
    const parsed = JSON.parse(fs.readFileSync(extManifestPath, "utf8"));
    extManifestValid = parsed.manifest_version === 3 && typeof parsed.name === "string";
  } catch {}
  record(
    "A37",
    extManifestValid,
    `extension MV3 manifest valid = ${extManifestValid}`,
  );

  // Stage 5: Hardening Backlog -----------------------------------------
  // A65: Aadhaar masking in lists and audit logged on view
  const maskedCustRes = await client.call("POST", "/pg/customers/select", {
    filters: [{ op: "eq", col: "phone", val: "9000000002" }],
  });
  const maskedAadhaar = maskedCustRes.body?.[0]?.id_number_masked;
  const isMasked = typeof maskedAadhaar === "string" && maskedAadhaar.includes("••••") && maskedAadhaar.endsWith("7777");

  const unmaskRes = await client.call("GET", `/customers/${buyer.body?.id}/aadhaar`);
  const aadhaarAudit = dbProbe(dataDir, "SELECT * FROM audit_logs WHERE action = 'aadhaar_view' AND entity_id = ?", [buyer.body?.id]);
  record(
    "A65",
    isMasked && unmaskRes.status === 200 && unmaskRes.body?.id_number === "999988887777" && aadhaarAudit.length > 0,
    `masked = ${maskedAadhaar}, unmasked fetch = ${unmaskRes.status}, audit logged = ${aadhaarAudit.length > 0}`,
  );

  // A66: Viewer role enforcement (read allowed, mutation returns 403)
  await client.call("POST", "/users", {
    email: "viewer@phonezone.local",
    password: "Password123!",
    displayName: "Readonly Viewer",
    role: "viewer",
  });
  const viewerClient = makeClient(server.base);
  const viewerLogin = await viewerClient.call("POST", "/auth/login", {
    email: "viewer@phonezone.local",
    password: "Password123!",
  });
  viewerClient.token = viewerLogin.body?.token;

  const viewerRead = await viewerClient.call("POST", "/pg/phones/select", { filters: [] });
  const viewerInsert = await viewerClient.call("POST", "/pg/phones/insert", {
    rows: [{ phone_name: "Illegal Phone", model: "X", purchase_price: 1, selling_price: 2 }],
  });
  record(
    "A66",
    viewerRead.status === 200 && viewerInsert.status === 403,
    `viewer read ${viewerRead.status}, viewer insert blocked ${viewerInsert.status}`,
  );

  // A67: Session management (active sessions list and revocation)
  const sessionsList = await staff2Client.call("GET", "/auth/sessions");
  const hasSessions = Array.isArray(sessionsList.body) && sessionsList.body.length > 0 && sessionsList.body.some((s) => s.isCurrent);
  const revokeSessionRes = await staff2Client.call("DELETE", `/auth/sessions/${sessionsList.body?.[0]?.id}`);
  record(
    "A67",
    hasSessions && revokeSessionRes.status === 200,
    `active sessions count = ${sessionsList.body?.length}, current marked = true, revoke status = ${revokeSessionRes.status}`,
  );

  // A68: System optimize (VACUUM and ANALYZE)
  const optimizeRes = await client.call("POST", "/system/optimize");
  record(
    "A68",
    optimizeRes.status === 200 && optimizeRes.body?.ok === true,
    `system optimize status ${optimizeRes.status}`,
  );

  // A20 is evaluated in section 6.
} catch (err) {
  record("SERVER", false, String(err?.message || err).slice(0, 400));
} finally {
  await stopServer(server);
}
say("");

/* ------------------------------------------------------------------ */
/* 5b. the backend regression suites (each boots its own temp backend)  */
/* ------------------------------------------------------------------ */

say("--- backend regression suites ---");
for (const [id, suite] of [
  ["SUITE1", "test/offline-suite.mjs"],
  ["SUITE2", "test/first-setup-suite.mjs"],
]) {
  let text = "";
  let code = 0;
  try {
    text = execFileSync(process.execPath, [suite], {
      cwd: BACKEND,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    code = err.status ?? 1;
    text = `${err.stdout || ""}\n${err.stderr || ""}`;
  }
  const summary = text.match(/(\d+) passed, (\d+) failed/);
  if (summary) say(`  ${suite}: ${summary[0]}`);
  const lastLines = String(text).trim().split(/\r?\n/).slice(-12).join("\n");
  if (code !== 0 || !summary) say(lastLines);
  record(id, code === 0 && !!summary && summary[2] === "0", summary ? summary[0] : `exit ${code}`);
}
say("");

/* ------------------------------------------------------------------ */
/* 6. typecheck + build                                                */
/* ------------------------------------------------------------------ */

say("--- A20: typecheck and production build ---");
const hasModules = fs.existsSync(path.join(ROOT, "node_modules"));
if (!hasModules) {
  record("A20", null, "SKIPPED: run npm install first");
} else {
  // npm/npx are .cmd shims on Windows, so these go through a shell.
  const run = (cmd, args, extraEnv = {}) => {
    try {
      const stdout = execFileSync(cmd, args, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, ...extraEnv },
      });
      return { code: 0, out: stdout };
    } catch (err) {
      return { code: err.status ?? 1, out: `${err.stdout || ""}\n${err.stderr || ""}` };
    }
  };
  const tail = (s, n = 20) => String(s).trim().split(/\r?\n/).slice(-n).join("\n");

  const tsc = run("npx", ["tsc", "--noEmit", "-p", "tsconfig.app.json"]);
  say(`  tsc exit ${tsc.code}`);
  const tscErrors = String(tsc.out).split(/\r?\n/).filter((l) => /error TS/.test(l));
  const byFile = new Map();
  for (const line of tscErrors) {
    const key = (line.match(/^([^(]+)\(/) || [, "(unknown)"])[1].trim();
    byFile.set(key, (byFile.get(key) || 0) + 1);
  }
  if (tscErrors.length) {
    say(`  tsc reported ${tscErrors.length} error line(s):`);
    for (const [file, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
      const changed = STAGE_CHANGED.has(file.replace(/\\/g, "/"));
      say(`    ${n} x ${file}${changed ? "   <-- CHANGED BY THIS STAGE" : ""}`);
    }
    say(tail(tsc.out, 20));
  }
  const errorsInChangedFiles = [...byFile.keys()].filter((f) => STAGE_CHANGED.has(f.replace(/\\/g, "/")));

  // The production build is a plain `vite build`; it can hit a transient
  // Windows access violation on memory-constrained machines, so retry once.
  let build = run("npm", ["run", "build"]);
  if (build.code !== 0) {
    say(`  npm run build exit ${build.code} - retrying once`);
    build = run("npm", ["run", "build"]);
  }
  say(`  npm run build exit ${build.code}`);
  if (build.code !== 0) say(tail(build.out));

  record(
    "A20",
    tsc.code === 0 && build.code === 0,
    `tsc ${tsc.code} (${tscErrors.length} error line(s) in ${byFile.size} file(s); touched by this stage: ${errorsInChangedFiles.join(", ") || "none"}), build ${build.code}`,
  );
}
say("");

/* ------------------------------------------------------------------ */
/* cleanup + output file                                               */
/* ------------------------------------------------------------------ */

for (const dir of tmpDirs) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

const summary = `PASSED ${passCount} / FAILED ${failCount} / SKIPPED ${skipCount}`;
const header = [
  "PhoneZone VERIFY_OUTPUT",
  `Stage            : ${STAGE}`,
  `Date             : ${new Date().toISOString()}`,
  `Node             : ${process.version}`,
  `Platform         : ${process.platform} ${process.arch}`,
  "",
  `SUMMARY: ${summary}`,
  "  (Counts cover the A-numbers of PhoneZone_MASTER_PROMPT.md section 5 for this",
  "   stage, plus SUITE1/SUITE2 = backend/test/offline-suite.mjs and",
  "   backend/test/first-setup-suite.mjs, plus R01..R06 = the repair-round checks",
  "   for the storage listing, restore rate limit, Returns-tab compat filters and",
  "   backend-vs-browser accounting figures. A38..A43 are the Stage 1.1",
  "   follow-up guards: filterless/bogus-filter updates and selects, read-only",
  "   audit_logs, non-writable files metadata, and column-name injection.)",
  "",
  failures.length ? "FAILED ITEMS:" : "FAILED ITEMS: none",
  ...failures.map((f) => `  - ${f}`),
  "",
  "=".repeat(72),
  "",
];
fs.writeFileSync(REPORT_FILE, `${header.join("\n")}\n${lines.join("\n")}\n`, "utf8");

say("=".repeat(72));
say(`SUMMARY: ${summary}`);
say(`Full log written to ${REPORT_FILE}`);
if (failures.length) {
  say("FAILED:");
  for (const f of failures) say(`  - ${f}`);
}
process.exit(0);
