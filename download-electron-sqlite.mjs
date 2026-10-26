import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

async function downloadAndExtract() {
  const url = "https://github.com/WiseLibs/better-sqlite3/releases/download/v9.6.0/better-sqlite3-v9.6.0-electron-v119-win32-x64.tar.gz";
  const tarPath = path.resolve("electron-v119.tar.gz");
  console.log("Downloading", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed: " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tarPath, buf);
  console.log("Downloaded", buf.length, "bytes. Extracting...");

  const outDir = path.resolve("backend/node_modules/better-sqlite3/prebuilds/win32-x64-abi119");
  fs.mkdirSync(outDir, { recursive: true });

  // Use tar to extract
  execSync(`tar -xzf "${tarPath}" -C "${outDir}"`, { stdio: "inherit" });
  console.log("Extracted to", outDir);

  // Copy to build/Release
  const releaseDir = path.resolve("backend/node_modules/better-sqlite3/build/Release");
  fs.mkdirSync(releaseDir, { recursive: true });
  fs.copyFileSync(path.join(outDir, "build/Release/better_sqlite3.node"), path.join(releaseDir, "better_sqlite3.node"));
  console.log("Copied to", path.join(releaseDir, "better_sqlite3.node"));

  // Also copy to dist-electron unpacked resources
  const unpackedRelease = path.resolve("dist-electron/win-unpacked/resources/backend/node_modules/better-sqlite3/build/Release");
  if (fs.existsSync(unpackedRelease)) {
    fs.copyFileSync(path.join(outDir, "build/Release/better_sqlite3.node"), path.join(unpackedRelease, "better_sqlite3.node"));
    console.log("Copied to unpacked resources!");
  }
}

downloadAndExtract().catch(console.error);

