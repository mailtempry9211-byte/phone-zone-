/**
 * Universal Hardware ID (HWID) & Platform Detector
 * Robust and resilient across Windows (EXE/Node), Linux (Kali), Termux/Android (APK), and Cloud (Render).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import cp from "node:child_process";
import crypto from "node:crypto";
import { APP_DATA_DIR } from "../config/paths.js";

let cachedHwid = null;
let cachedPlatform = null;

/**
 * Detect running application platform:
 * 'exe'   - Windows Electron binary or native Windows bundle
 * 'apk'   - Android / Termux environment
 * 'linux' - Linux / Kali desktop or server
 * 'web'   - Cloud hosting (Render, VPS, Docker)
 */
export function getPlatformType() {
  if (cachedPlatform) return cachedPlatform;

  if (process.env.TERMUX_VERSION) {
    cachedPlatform = "termux";
  } else if (process.platform === "android") {
    cachedPlatform = "apk";
  } else if (process.versions && process.versions.electron) {
    cachedPlatform = "exe";
  } else if (process.platform === "win32") {
    // If running in packaged electron or Windows service
    cachedPlatform = "exe";
  } else if (process.env.RENDER || process.env.RAILWAY_STATIC_URL || process.env.DOCKER_CONTAINER) {
    cachedPlatform = "web";
  } else if (process.platform === "linux") {
    cachedPlatform = "linux";
  } else {
    cachedPlatform = "web";
  }

  return cachedPlatform;
}

/**
 * Generates a stable, unique Hardware ID (HWID).
 * Cached in memory and persisted in data directory so reboots never change it.
 */
export function getHardwareId() {
  if (cachedHwid) return cachedHwid;

  const dataDir = APP_DATA_DIR;
  const hwidFile = path.join(dataDir, "machine_hwid.dat");

  // 1. Check if persistent HWID file already exists
  try {
    if (fs.existsSync(hwidFile)) {
      const stored = fs.readFileSync(hwidFile, "utf8").trim();
      if (stored && stored.length >= 16) {
        cachedHwid = stored;
        return cachedHwid;
      }
    }
  } catch {}

  let rawHwidSeed = "";

  // 2. Try OS-specific native identifiers
  if (process.platform === "win32") {
    try {
      // Query Windows Registry MachineGuid
      const out = cp.execSync(
        'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { timeout: 3000, encoding: "utf8" }
      );
      const match = out.match(/MachineGuid\s+REG_SZ\s+([a-zA-Z0-9-]+)/i);
      if (match && match[1]) {
        rawHwidSeed = "WIN-MG-" + match[1].trim();
      }
    } catch {}
  } else if (process.platform === "linux") {
    try {
      if (fs.existsSync("/etc/machine-id")) {
        rawHwidSeed = "LNX-MID-" + fs.readFileSync("/etc/machine-id", "utf8").trim();
      } else if (fs.existsSync("/var/lib/dbus/machine-id")) {
        rawHwidSeed = "LNX-MID-" + fs.readFileSync("/var/lib/dbus/machine-id", "utf8").trim();
      }
    } catch {}
  }

  // 3. Fallback to CPU + Network MAC + Hostname hash
  if (!rawHwidSeed) {
    try {
      const networkInterfaces = os.networkInterfaces();
      const macs = [];
      for (const iface of Object.values(networkInterfaces)) {
        if (!iface) continue;
        for (const config of iface) {
          if (!config.internal && config.mac && config.mac !== "00:00:00:00:00:00") {
            macs.push(config.mac);
          }
        }
      }
      const cpus = os.cpus();
      const cpuModel = cpus && cpus[0] ? cpus[0].model : "";
      const baseSeed = [os.hostname(), os.arch(), cpuModel, macs.sort().join(",")].join("|");
      rawHwidSeed = "SYS-" + crypto.createHash("sha256").update(baseSeed).digest("hex");
    } catch {
      rawHwidSeed = "RND-" + crypto.randomUUID();
    }
  }

  // Generate standardized 32-character HWID: PZ-HWID-XXXXXXXX-XXXXXXXX
  const hash = crypto.createHash("sha256").update(rawHwidSeed).digest("hex").toUpperCase();
  const finalHwid = `HWID-${hash.slice(0, 8)}-${hash.slice(8, 16)}-${hash.slice(16, 24)}`;

  // Persist to file so container redeploys or restarts with volume preserve the HWID
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(hwidFile, finalHwid, "utf8");
  } catch {}

  cachedHwid = finalHwid;
  return cachedHwid;
}

export function getDeviceInfo() {
  return {
    hwid: getHardwareId(),
    platform: getPlatformType(),
    hostname: os.hostname(),
    osType: os.type(),
    osRelease: os.release(),
    arch: os.arch(),
  };
}
