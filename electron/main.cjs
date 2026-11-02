/**
 * PhoneZone Electron Main Process (CommonJS).
 * Runs the local backend directly in the Electron process and opens the desktop window.
 */
const { app, BrowserWindow, shell, dialog, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

// Enforce strictly ONE instance of PhoneZone desktop application.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Ensure child or inherited env variables don't force node mode
delete process.env.ELECTRON_RUN_AS_NODE;

const PORT = 47713;
let mainWindow = null;
let httpServer = null;
let closeDbFn = null;

const isDev = !app.isPackaged;
const appRoot = isDev
  ? path.resolve(__dirname, "..")
  : process.resourcesPath;

process.env.PHONEZONE_HOST = "127.0.0.1";
process.env.PHONEZONE_PORT = String(PORT);
process.env.PHONEZONE_APP_ROOT = appRoot;

// Support --fresh or --new-client to simulate a brand-new computer with zero existing data
const isFreshMode = process.argv.includes("--fresh") || process.argv.includes("--new-client");
if (isFreshMode) {
  const freshDir = path.join(app.getPath("temp"), "PhoneZone_Fresh_Test_" + Date.now());
  try { fs.mkdirSync(freshDir, { recursive: true }); } catch {}
  process.env.PHONEZONE_DATA_DIR = freshDir;
}

let logFile = null;
try {
  const logDir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  logFile = path.join(logDir, "phonezone-desktop.log");
} catch {}

function log(msg) {
  const line = `[${new Date().toISOString()}] [PhoneZone] ${msg}\n`;
  console.log(`[PhoneZone] ${msg}`);
  if (logFile) {
    try {
      fs.appendFileSync(logFile, line);
    } catch {}
  }
}

process.on("uncaughtException", (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`);
});

process.on("unhandledRejection", (reason) => {
  log(`UNHANDLED REJECTION: ${reason}`);
});

async function startServer() {
  log(`Initializing backend from: ${appRoot}`);
  
  // Ensure native module matches Electron ABI (119 for Electron 28)
  const ensureNative = path.join(appRoot, "backend", "ensure-native.cjs");
  if (fs.existsSync(ensureNative)) {
    try {
      const helper = require(ensureNative);
      if (typeof helper.ensureNative === "function") {
        helper.ensureNative();
      }
    } catch (nativeErr) {
      log(`Native probe warning: ${nativeErr.message}`);
    }
  }

  const serverPath = path.join(appRoot, "backend", "src", "server.js");
  const dbPath = path.join(appRoot, "backend", "src", "db", "index.js");

  const { createServer } = await import(pathToFileURL(serverPath).href);
  const { closeDatabase } = await import(pathToFileURL(dbPath).href);
  closeDbFn = closeDatabase;

  const { app: expressApp } = createServer();

  return new Promise((resolve, reject) => {
    httpServer = expressApp.listen(PORT, "127.0.0.1", () => {
      log(`Backend HTTP listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
    httpServer.on("error", async (err) => {
      if (err.code === "EADDRINUSE") {
        log(`Port ${PORT} is in use or TIME_WAIT, verifying backend health...`);
        try {
          const res = await fetch(`http://127.0.0.1:${PORT}/api/setup/status`);
          if (res.ok) {
            log(`Backend on ${PORT} is healthy and responding.`);
            resolve();
            return;
          }
        } catch {}
        log(`Waiting 1s for port ${PORT} socket release...`);
        setTimeout(() => {
          try {
            httpServer = expressApp.listen(PORT, "127.0.0.1", () => {
              log(`Backend HTTP listening on http://127.0.0.1:${PORT}`);
              resolve();
            });
            httpServer.on("error", () => resolve());
          } catch {
            resolve();
          }
        }, 1000);
      } else {
        reject(err);
      }
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 380,
    minHeight: 600,
    title: "PhoneZone - Store & Repair Manager",
    icon: path.join(appRoot, "icon.ico"),
    autoHideMenuBar: true,
    backgroundColor: "#07090e",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  });

  // Show window only when content has finished loading or is ready
  mainWindow.webContents.on("did-finish-load", () => {
    log("did-finish-load fired, showing window");
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  mainWindow.once("ready-to-show", () => {
    log("ready-to-show fired, showing window");
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  // Capture any console messages from the frontend
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log(`[Renderer] [L${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log(`[Renderer Process Gone] reason: ${details.reason}, exitCode: ${details.exitCode}`);
  });

  // Safeguard: show window if ready-to-show didn't fire within 3 seconds
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      log("Safeguard timeout: showing mainWindow");
      mainWindow.show();
    }
  }, 3500);

  // Auto-retry connection if backend was still spinning up (prevents white screen)
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    log(`did-fail-load: ${validatedURL} [${errorCode}] ${errorDescription}`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        log(`Retrying loading http://127.0.0.1:${PORT}...`);
        mainWindow.loadURL(`http://127.0.0.1:${PORT}`).catch(() => {});
      }
    }, 1000);
  });

  // Handle keyboard shortcuts (F5 / Ctrl+R / Alt+Left / Alt+Right)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown") {
      if (input.key === "F5" || ((input.control || input.meta) && input.key.toLowerCase() === "r")) {
        mainWindow.webContents.reload();
        event.preventDefault();
      } else if (input.alt && input.key === "ArrowLeft") {
        if (mainWindow.webContents.canGoBack()) {
          mainWindow.webContents.goBack();
          event.preventDefault();
        }
      } else if (input.alt && input.key === "ArrowRight") {
        if (mainWindow.webContents.canGoForward()) {
          mainWindow.webContents.goForward();
          event.preventDefault();
        }
      }
    }
  });

  // Right-click context menu (Back, Forward, Reload)
  mainWindow.webContents.on("context-menu", (_e, params) => {
    const menu = Menu.buildFromTemplate([
      {
        label: "Back (Alt + Left)",
        enabled: mainWindow.webContents.canGoBack(),
        click: () => mainWindow.webContents.goBack(),
      },
      {
        label: "Forward (Alt + Right)",
        enabled: mainWindow.webContents.canGoForward(),
        click: () => mainWindow.webContents.goForward(),
      },
      {
        label: "Reload (F5 / Ctrl + R)",
        click: () => mainWindow.webContents.reload(),
      },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ]);
    menu.popup();
  });

  // Open external links in user's default browser, but allow about:blank / print windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank" || url === "" || url.startsWith("data:")) {
      return { action: "allow" };
    }
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Handle initial connection drops or slow backend startup gracefully
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    log(`Page load failed (${errorCode}: ${errorDescription}), retrying...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`http://127.0.0.1:${PORT}`).catch(() => {});
      }
    }, 500);
  });

  try {
    await startServer();

    let initialUrl = `http://127.0.0.1:${PORT}`;
    // Verify backend HTTP readiness before loading URL (up to 15 seconds)
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const check = await fetch(`http://127.0.0.1:${PORT}/api/setup/status`);
        if (check.ok) {
          const status = await check.json();
          if (status.setupCompleted === false) {
            initialUrl = `http://127.0.0.1:${PORT}/setup`;
          }
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }

    await mainWindow.loadURL(initialUrl);
  } catch (err) {
    log(`Startup error: ${err.message}`);
    dialog.showErrorBox(
      "PhoneZone Startup Error",
      `The local server could not start:\n\n${err.message}\n\n${err.stack || ""}`
    );
    mainWindow.loadURL(`data:text/html,<h2>PhoneZone Error</h2><pre>${err.message}</pre>`);
    mainWindow.show();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function cleanup() {
  if (httpServer) {
    try {
      httpServer.close();
    } catch (_e) {}
    httpServer = null;
  }
  if (closeDbFn) {
    try {
      closeDbFn();
    } catch (_e) {}
    closeDbFn = null;
  }
}

app.on("before-quit", cleanup);
app.on("will-quit", cleanup);
app.on("window-all-closed", () => {
  cleanup();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
