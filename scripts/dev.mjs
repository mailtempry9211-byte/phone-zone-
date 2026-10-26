// Starts the PhoneZone backend (port 47713) AND the Vite dev server (port 8080)
// together, so the /api proxy always has something to talk to.
//   usage: npm run dev:all
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const win = process.platform === "win32";

// 1) make sure better-sqlite3 matches this Node (fixes ABI mismatch after Electron rebuilds)
const native = spawnSync(process.execPath, ["ensure-native.cjs"], { cwd: backend, stdio: "inherit" });
if (native.status !== 0) {
  console.error("\n[dev] better-sqlite3 is not usable. Run:  cd backend && npm install && npm rebuild better-sqlite3");
  process.exit(1);
}

const env = { ...process.env, PHONEZONE_DATA_DIR: process.env.PHONEZONE_DATA_DIR || path.join(root, "data") };
const procs = [
  spawn(process.execPath, ["src/server.js"], { cwd: backend, stdio: "inherit", env }),
  spawn(win ? "npx.cmd" : "npx", ["vite"], { cwd: root, stdio: "inherit", env, shell: win }),
];

const stop = () => procs.forEach((p) => !p.killed && p.kill());
procs.forEach((p) => p.on("exit", (code) => { stop(); process.exit(code ?? 0); }));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
