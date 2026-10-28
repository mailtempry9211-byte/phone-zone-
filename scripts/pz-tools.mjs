// PhoneZone control-panel helper (called by PHONEZONE-CONTROL.bat).
//
//   node scripts/pz-tools.mjs status      exit 0 = setup done, 1 = not set up yet, 2 = cannot tell
//   node scripts/pz-tools.mjs needsbuild  exit 1 = dist/ missing or older than the source files
//   node scripts/pz-tools.mjs backup      full backup into data/backups (+ optional extra copy)
//   node scripts/pz-tools.mjs restore     interactive restore (server must be stopped)
//
// Backups use the SAME format as Admin > Database in the app (.tar.gz with
// database/, storage/, manifest.json), so both tools can restore each other's files.
// Only Node built-ins + the backend's better-sqlite3 are used.
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function resolveDataDir() {
  if (process.env.PHONEZONE_DATA_DIR && fs.existsSync(path.join(process.env.PHONEZONE_DATA_DIR, "database", "phonezone.db"))) {
    return path.resolve(process.env.PHONEZONE_DATA_DIR);
  }
  const appData = process.platform === "win32"
    ? path.join(process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming"), "PhoneZone")
    : path.join(process.env.HOME || "", ".local", "share", "PhoneZone");
  if (fs.existsSync(path.join(appData, "database", "phonezone.db"))) {
    return appData;
  }
  if (fs.existsSync(path.join(ROOT, "data", "database", "phonezone.db"))) {
    return path.join(ROOT, "data");
  }
  return process.env.PHONEZONE_DATA_DIR ? path.resolve(process.env.PHONEZONE_DATA_DIR) : appData;
}
const DATA = resolveDataDir();
const DB_FILE = path.join(DATA, "database", "phonezone.db");
const BACKUPS = path.join(DATA, "backups");
const PORT = Number(process.env.PHONEZONE_PORT || 47713);
const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

const say = (...a) => console.log(...a);
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const unquote = (s) => s.trim().replace(/^"+|"+$/g, "").trim();

function openDb() {
  const req = createRequire(path.join(ROOT, "backend", "package.json"));
  const Database = req("better-sqlite3");
  return new Database(DB_FILE, { fileMustExist: true });
}

function tar(args, opts = {}) {
  try {
    execFileSync("tar", args, { stdio: ["ignore", "ignore", "pipe"], ...opts });
  } catch (e) {
    const detail = e.stderr ? String(e.stderr).trim() : e.message;
    throw new Error(`tar failed: ${detail}`);
  }
}

// Queue-based line reader. (The promise version of readline.question drops lines
// that were already buffered, which breaks piped input and fast pasting.)
function makeAsker() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = [];
  let waiter = null;
  let closed = false;
  rl.on("line", (l) => {
    if (waiter) { const w = waiter; waiter = null; w(l); } else lines.push(l);
  });
  rl.on("close", () => {
    closed = true;
    if (waiter) { const w = waiter; waiter = null; w(""); }
  });
  return {
    ask(prompt) {
      rl.setPrompt(prompt);
      rl.prompt();
      return new Promise((resolve) => {
        if (lines.length) resolve(lines.shift());
        else if (closed) resolve("");
        else waiter = resolve;
      });
    },
    close() { rl.close(); },
  };
}

function serverRunning() {
  return new Promise((resolve) => {
    const s = net.connect({ port: PORT, host: "127.0.0.1" });
    s.setTimeout(700);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
}

/* ---------------------------------------------------------------- status */
function cmdStatus() {
  if (!fs.existsSync(DB_FILE)) return 1;
  let db;
  try { db = openDb(); } catch { return 2; }
  try {
    const row = db.prepare("SELECT setup_completed FROM admin_settings WHERE id = ?").get(SETTINGS_ID);
    return row?.setup_completed ? 0 : 1;
  } catch (e) {
    return /no such table/i.test(String(e.message)) ? 1 : 2;
  } finally {
    db.close();
  }
}

/* ------------------------------------------------------------ needsbuild */
function newest(p) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.mtimeMs;
  let m = 0;
  for (const n of fs.readdirSync(p)) m = Math.max(m, newest(path.join(p, n)));
  return m;
}
function cmdNeedsBuild() {
  const out = path.join(ROOT, "dist", "index.html");
  if (!fs.existsSync(out)) return 1;
  const builtAt = fs.statSync(out).mtimeMs;
  const inputs = ["src", "public", "index.html", "vite.config.ts", "tailwind.config.ts", "postcss.config.js"]
    .map((p) => path.join(ROOT, p))
    .filter((p) => fs.existsSync(p));
  return inputs.some((p) => newest(p) > builtAt + 1000) ? 1 : 0;
}

/* ---------------------------------------------------------------- backup */
function makeBackup() {
  if (!fs.existsSync(DB_FILE)) throw new Error("No database found yet - there is nothing to back up.");
  fs.mkdirSync(BACKUPS, { recursive: true });

  const manifest = { createdAt: new Date().toISOString(), app: "PhoneZone" };
  const db = openDb();
  try {
    db.pragma("wal_checkpoint(TRUNCATE)"); // flush WAL so the .db file is complete
    manifest.schemaVersions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((r) => r.version);
    manifest.counts = {};
    for (const t of ["sellers", "customers", "phones", "returns", "repairs", "invoices", "files", "messages"]) {
      try { manifest.counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch { /* table missing */ }
    }
  } finally {
    db.close();
  }
  fs.writeFileSync(path.join(DATA, "manifest.json"), JSON.stringify(manifest, null, 2));

  const name = `PhoneZone_Backup_${stamp()}.tar.gz`;
  const file = path.join(BACKUPS, name);
  const items = ["database", "storage", "config", "manifest.json"].filter((i) => fs.existsSync(path.join(DATA, i)));
  tar(["-czf", file, "--exclude=*.db-wal", "--exclude=*.db-shm", ...items], { cwd: DATA });
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error("The backup file was not created.");
  return { file, name, manifest, size: fs.statSync(file).size };
}

async function cmdBackup() {
  let r;
  try {
    r = makeBackup();
  } catch (e) {
    say(`  [ERROR] ${e.message}`);
    return 1;
  }
  const c = r.manifest.counts || {};
  say("");
  say("  [OK] Backup created");
  say(`  File   : ${r.file}`);
  say(`  Size   : ${mb(r.size)}`);
  say(`  Inside : ${c.phones ?? 0} phones, ${c.sellers ?? 0} sellers, ${c.customers ?? 0} customers, ${c.invoices ?? 0} invoices, ${c.files ?? 0} files`);
  say("");

  const rl = makeAsker();
  try {
    const dest = unquote(await rl.ask("  Also copy it to another folder or drive, e.g. E:\\Backups ? Press Enter to skip: "));
    if (dest) {
      try {
        fs.mkdirSync(dest, { recursive: true });
        const target = path.join(dest, r.name);
        fs.copyFileSync(r.file, target);
        say(`  [OK] Copied to ${target}`);
      } catch (e) {
        say(`  [WARNING] Could not copy there: ${e.message}`);
      }
    }
  } finally {
    rl.close();
  }
  return 0;
}

/* --------------------------------------------------------------- restore */
async function cmdRestore() {
  if (await serverRunning()) {
    say("  [ERROR] The server is still running. Stop it first (menu option 3), then try again.");
    return 1;
  }

  const files = fs.existsSync(BACKUPS)
    ? fs.readdirSync(BACKUPS)
        .filter((f) => /\.(tar\.gz|tgz|zip)$/i.test(f))
        .map((f) => {
          const p = path.join(BACKUPS, f);
          const s = fs.statSync(p);
          return { name: f, path: p, size: s.size, mtime: s.mtime };
        })
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 15)
    : [];

  say("");
  if (files.length) {
    say("  Backups found in the data\\backups folder, newest first:");
    say("");
    files.forEach((f, i) => {
      const when = f.mtime.toISOString().replace("T", " ").slice(0, 16);
      say(`   [${String(i + 1).padStart(2)}] ${f.name}   ${mb(f.size)}   ${when}`);
    });
  } else {
    say("  No backups found in the data\\backups folder.");
  }
  say("");

  const rl = makeAsker();
  let temp = null;
  try {
    const ans = unquote(await rl.ask("  Enter a number, OR drag a backup file into this window / paste its full path (Enter = cancel): "));
    if (!ans) { say("  Cancelled."); return 1; }

    let src;
    if (/^\d+$/.test(ans) && files[Number(ans) - 1]) src = files[Number(ans) - 1].path;
    else src = path.resolve(ans);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
      say(`  [ERROR] File not found: ${src}`);
      return 1;
    }

    // 1) Unpack into a temp folder and validate BEFORE touching live data.
    temp = path.join(DATA, `.restore-${stamp()}`);
    fs.mkdirSync(temp, { recursive: true });
    try {
      tar(["-xf", src, "-C", temp]);
    } catch (e) {
      say("  [ERROR] Could not open that file. Is it a PhoneZone backup (.tar.gz or .zip)?");
      say(`  ${e.message}`);
      return 1;
    }
    let base = temp;
    if (!fs.existsSync(path.join(base, "database"))) {
      // a .zip made with Windows "Send to > Compressed folder" has one extra top-level folder
      const sub = fs.readdirSync(temp).map((n) => path.join(temp, n))
        .find((p) => fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, "database")));
      if (sub) base = sub;
    }
    if (!fs.existsSync(path.join(base, "database", "phonezone.db"))) {
      say("  [ERROR] This is not a valid PhoneZone backup (database\\phonezone.db is missing).");
      return 1;
    }

    let info = null;
    try { info = JSON.parse(fs.readFileSync(path.join(base, "manifest.json"), "utf8")); } catch { /* optional */ }
    say("");
    say(`  Backup  : ${path.basename(src)}`);
    if (info?.createdAt) say(`  Created : ${info.createdAt.replace("T", " ").slice(0, 16)}`);
    if (info?.counts) {
      const c = info.counts;
      say(`  Contains: ${c.phones ?? 0} phones, ${c.sellers ?? 0} sellers, ${c.customers ?? 0} customers, ${c.invoices ?? 0} invoices`);
    }

    // 2) Confirm + safety backup when replacing existing data.
    const hasCurrent = fs.existsSync(DB_FILE);
    if (hasCurrent) {
      say("");
      say("  WARNING: this will REPLACE the data currently in PhoneZone.");
      say("  A safety backup of the current data is made first, and the old data is also kept aside.");
      const yes = (await rl.ask("  Type YES to continue: ")).trim();
      if (yes !== "YES") { say("  Cancelled. Nothing was changed."); return 1; }
      try {
        const safety = makeBackup();
        say(`  [OK] Safety backup of current data: ${safety.name}`);
      } catch (e) {
        say(`  [ERROR] Could not make the safety backup, so nothing was changed: ${e.message}`);
        return 1;
      }
    }

    // 3) Swap in (with rollback if anything fails).
    for (const suffix of ["-wal", "-shm", "-journal"]) {
      fs.rmSync(path.join(base, "database", `phonezone.db${suffix}`), { force: true });
    }
    const parked = path.join(DATA, `.previous-${stamp()}`);
    fs.mkdirSync(parked, { recursive: true });
    const moved = [];
    try {
      for (const dir of ["database", "storage", "config"]) {
        const incoming = path.join(base, dir);
        if (!fs.existsSync(incoming)) continue;
        const cur = path.join(DATA, dir);
        const park = path.join(parked, dir);
        const hadCur = fs.existsSync(cur);
        if (hadCur) fs.renameSync(cur, park);
        moved.push({ cur, park, hadCur });
        fs.renameSync(incoming, cur);
      }
    } catch (e) {
      for (const m of moved.reverse()) {
        try {
          fs.rmSync(m.cur, { recursive: true, force: true });
          if (m.hadCur) fs.renameSync(m.park, m.cur);
        } catch { /* best effort */ }
      }
      say(`  [ERROR] Restore failed and was rolled back: ${e.message}`);
      say("  Make sure the PhoneZone server window is closed, then try again.");
      return 1;
    }

    say("");
    say("  [OK] Restore complete.");
    if (hasCurrent) say(`  Your previous data was kept at: ${parked}`);
    else { try { fs.rmSync(parked, { recursive: true, force: true }); } catch { /* ignore */ } }
    return 0;
  } finally {
    if (temp) { try { fs.rmSync(temp, { recursive: true, force: true }); } catch { /* ignore */ } }
    rl.close();
  }
}

/* ------------------------------------------------------------------ main */
const cmd = process.argv[2];
let code = 0;
try {
  if (cmd === "status") code = cmdStatus();
  else if (cmd === "needsbuild") code = cmdNeedsBuild();
  else if (cmd === "backup") code = await cmdBackup();
  else if (cmd === "restore") code = await cmdRestore();
  else { say("usage: pz-tools.mjs status|needsbuild|backup|restore"); code = 2; }
} catch (e) {
  say(`  [ERROR] ${e.message}`);
  code = 1;
}
process.exit(code);
