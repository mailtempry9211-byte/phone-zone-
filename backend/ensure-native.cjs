// PhoneZone - ensure the better-sqlite3 native binary matches the current Node
// runtime before the backend starts.  (CommonJS: the backend package is ESM.)
//
// Rationale: the repo's backend folder is reused by BOTH the system-Node local
// server (ABI 127 on Node 22) and, as a COPY, by the packaged Electron EXE
// (Electron 28 -> ABI 119). Electron packaging rebuilds the native module for
// Electron's ABI, which can leave the backend folder with a binary the system
// Node can no longer load (ERR_DLOPEN_FAILED / NODE_MODULE_VERSION mismatch).
//
// This guard loads the module; only when the ABI is wrong does it rebuild
// (fast: the load probe is ~ms, a rebuild only runs on an actual mismatch).
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function probe() {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(":memory:");
    db.close();
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * When the default build/Release binary has the wrong ABI (e.g. it was built
 * for system Node but Electron runs an older ABI), look for a matching prebuild
 * inside node_modules/better-sqlite3 and copy it into build/Release so that
 * `require("better-sqlite3")` (which uses the `bindings` package -> build/Release)
 * picks up the correct one.
 *
 * better-sqlite3 ships prebuilds in one of these layouts:
 *   prebuilds/<platform>-<arch>-<abi>/better-sqlite3.node
 *   bin/<platform>-<arch>-<abi>/better-sqlite3.node     (some builds)
 */
function findMatchingPrebuild() {
  const modDir = path.dirname(require.resolve("better-sqlite3/package.json"));
  const abi = process.versions.modules;
  const platform = process.platform;
  const arch = process.arch;
  const candidates = [
    path.join(modDir, "prebuilds"),
    path.join(modDir, "bin"),
  ];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory());
    for (const d of entries) {
      const full = d.toLowerCase();
      // Match dir names like: win32-x64-119, win32-x64-abi119, node-v119-win32-x64
      const hasAbi = full.includes(`${abi}`) && (full.includes(`-${abi}`) || full.includes(`abi${abi}`));
      const hasPlatform = full.includes(platform);
      const hasArch = full.includes(arch);
      if (!hasAbi || !hasPlatform || !hasArch) continue;
      const nested = path.join(dir, d);
      const nodeFile = fs.readdirSync(nested).find((f) => f.endsWith(".node"));
      if (nodeFile) return path.join(nested, nodeFile);
    }
  }
  return null;
}

function copyPrebuildToRelease() {
  const modDir = path.dirname(require.resolve("better-sqlite3/package.json"));
  const releaseDir = path.join(modDir, "build", "Release");
  fs.mkdirSync(releaseDir, { recursive: true });
  const src = findMatchingPrebuild();
  if (!src) return false;
  const dest = path.join(releaseDir, "better_sqlite3.node");
  fs.copyFileSync(src, dest);
  return probe();
}

function ensureNative() {
  if (probe()) {
    console.log("[phonezone] better-sqlite3 native binary OK for this Node runtime.");
    return true;
  }

  console.log("[phonezone] better-sqlite3 ABI mismatch (expected NODE_MODULE_VERSION " +
    process.versions.modules + ") -> searching for a matching prebuild...");

  if (copyPrebuildToRelease()) {
    console.log("[phonezone] Copied matching prebuild into build/Release - native module OK now.");
    return true;
  }

  if (require.main === module) {
    console.log("[phonezone] No matching prebuild found -> rebuilding from source...");
    const r = spawnSync(
      "npm",
      ["rebuild", "better-sqlite3", "--foreground-scripts"],
      { cwd: __dirname, shell: process.platform === "win32", stdio: "inherit" },
    );

    if (probe()) {
      console.log("[phonezone] native module rebuilt successfully.");
      return true;
    }

    console.error("[phonezone] Native module could not be fixed automatically.\n" +
      "  Run manually:  cd backend && npm rebuild better-sqlite3");
    return false;
  }

  return false;
}

module.exports = { ensureNative, probe };

if (require.main === module) {
  const ok = ensureNative();
  process.exit(ok ? 0 : 1);
} else {
  ensureNative();
}
