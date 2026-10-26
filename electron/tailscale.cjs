/**
 * Tailscale CLI wrapper for PhoneZone Electron Main process (CommonJS).
 * Manages tailnet-only serve for the admin port.
 * NEVER exposes the admin port to the public internet via Tailscale Funnel.
 */
const { execFileSync } = require("node:child_process");

class TailscaleManager {
  constructor(binPath = "tailscale") {
    this.binPath = binPath;
  }

  detect() {
    try {
      const out = execFileSync(this.binPath, ["status", "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const parsed = JSON.parse(out);
      const isRunning = parsed?.BackendState === "Running";
      return {
        installed: true,
        running: isRunning,
        backendState: parsed?.BackendState || "Unknown",
        self: parsed?.Self || null,
        tailnet: parsed?.CurrentTailnet?.Name || null,
      };
    } catch (err) {
      return {
        installed: false,
        running: false,
        backendState: "NotInstalled",
        error: "Tailscale CLI is not installed or not found in PATH.",
      };
    }
  }

  enableServe(port = 47713) {
    const portNum = Number(port) || 47713;
    const args = ["serve", "--bg", "--https=443", `http://127.0.0.1:${portNum}`];
    
    if (args.some((a) => a.includes("funnel"))) {
      throw new Error("Tailscale Funnel is forbidden on the PhoneZone admin port.");
    }

    try {
      execFileSync(this.binPath, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      return { ok: true, port: portNum };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  }

  disableServe() {
    try {
      execFileSync(this.binPath, ["serve", "--reset"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  }
}

module.exports = {
  TailscaleManager,
  tailscale: new TailscaleManager(),
};

