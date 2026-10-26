/**
 * PhoneZone Electron Main Process (CommonJS).
 * Runs the local backend directly in the Electron process and opens the desktop window.
 */
const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

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

function log(msg) {
  console.log(`[PhoneZone] ${msg}`);
}

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
    httpServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        log(`Port ${PORT} already in use, assuming backend is running`);
        resolve();
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
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

  try {
    await startServer();
    await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
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
